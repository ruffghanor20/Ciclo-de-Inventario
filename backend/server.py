from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io
import csv
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="EstoqueAudit API v2")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---- Models ----

class StockItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    codigo: str
    descricao: str
    categoria: str = ""
    unidade: str = "UN"
    localizacao: str = ""
    saldo_sistema: float = 0
    estoque_minimo: float = 0
    ativo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StockItemCreate(BaseModel):
    codigo: str
    descricao: str
    categoria: str = ""
    unidade: str = "UN"
    localizacao: str = ""
    saldo_sistema: float = 0
    estoque_minimo: float = 0


class InventorySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    responsavel: str = ""
    status: str = "aberta"
    data_inicio: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_fim: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventorySessionCreate(BaseModel):
    nome: str
    responsavel: str = ""


class CountEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    item_id: Optional[str] = None
    codigo: str
    descricao: str
    saldo_sistema: float = 0
    quantidade_contada: float = 0
    diferenca: float = 0
    localizacao: str = ""
    observacao: str = ""
    escaneado: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CountEntryCreate(BaseModel):
    session_id: str
    item_id: Optional[str] = None
    codigo: str
    descricao: str
    saldo_sistema: float = 0
    quantidade_contada: float = 0
    localizacao: str = ""
    observacao: str = ""
    escaneado: bool = False

def validate_quantidade_contada(quantidade: float) -> None:
    # Problema encontrado: a API aceitava quantidade negativa/NaN/infinita e persistia no banco.
    # Solução: validar antes de calcular diferença e salvar/atualizar.
    if not math.isfinite(quantidade) or quantidade < 0:
        raise HTTPException(status_code=422, detail="quantidade_contada deve ser um número finito e >= 0")


# ---- Stock Items ----

@api_router.get("/items", response_model=List[StockItem])
async def get_items(
    search: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    skip: int = Query(0),
):
    query: dict = {"ativo": True}
    if search:
        query["$or"] = [
            {"codigo": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}},
        ]
    if categoria:
        query["categoria"] = categoria
    items = await db.stock_items.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return items


@api_router.get("/items/barcode/{codigo}")
async def get_item_by_barcode(codigo: str):
    item = await db.stock_items.find_one({"codigo": codigo}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return item


@api_router.post("/items", response_model=StockItem)
async def create_item(item_data: StockItemCreate):
    existing = await db.stock_items.find_one({"codigo": item_data.codigo})
    if existing:
        raise HTTPException(status_code=400, detail="Código já cadastrado")
    item = StockItem(**item_data.dict())
    await db.stock_items.insert_one(item.dict())
    return item


@api_router.put("/items/{item_id}", response_model=StockItem)
async def update_item(item_id: str, item_data: StockItemCreate):
    item = await db.stock_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    update_data = item_data.dict()
    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.stock_items.update_one({"id": item_id}, {"$set": update_data})
    updated = await db.stock_items.find_one({"id": item_id}, {"_id": 0})
    return updated


@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str):
    result = await db.stock_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return {"message": "Item removido"}


@api_router.post("/items/bulk")
async def bulk_import_items(items: List[StockItemCreate]):
    created = 0
    updated = 0
    errors = []
    for item_data in items:
        try:
            existing = await db.stock_items.find_one({"codigo": item_data.codigo})
            if existing:
                await db.stock_items.update_one(
                    {"codigo": item_data.codigo},
                    {"$set": {**item_data.dict(), "updated_at": datetime.now(timezone.utc)}}
                )
                updated += 1
            else:
                item = StockItem(**item_data.dict())
                await db.stock_items.insert_one(item.dict())
                created += 1
        except Exception as e:
            errors.append({"codigo": item_data.codigo, "error": str(e)})
    return {"created": created, "updated": updated, "errors": errors}


# ---- Sessions ----

@api_router.get("/sessions", response_model=List[InventorySession])
async def get_sessions(status: Optional[str] = Query(None)):
    query: dict = {}
    if status:
        query["status"] = status
    sessions = await db.sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return sessions


@api_router.post("/sessions", response_model=InventorySession)
async def create_session(session_data: InventorySessionCreate):
    session = InventorySession(**session_data.dict())
    await db.sessions.insert_one(session.dict())
    return session


@api_router.get("/sessions/{session_id}", response_model=InventorySession)
async def get_session(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return session


@api_router.put("/sessions/{session_id}/close")
async def close_session(session_id: str):
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "fechada", "data_fim": datetime.now(timezone.utc)}}
    )
    return {"message": "Sessão encerrada"}


# ---- Counts ----

@api_router.get("/sessions/{session_id}/counts", response_model=List[CountEntry])
async def get_session_counts(session_id: str):
    counts = await db.count_entries.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)
    return counts


@api_router.post("/counts", response_model=CountEntry)
async def create_count(count_data: CountEntryCreate):
    validate_quantidade_contada(count_data.quantidade_contada)
    entry = CountEntry(
        **count_data.dict(),
        diferenca=count_data.quantidade_contada - count_data.saldo_sistema
    )
    await db.count_entries.insert_one(entry.dict())
    return entry


@api_router.put("/counts/{count_id}")
async def update_count(count_id: str, quantidade_contada: float, observacao: str = ""):
    validate_quantidade_contada(quantidade_contada)
    count = await db.count_entries.find_one({"id": count_id}, {"_id": 0})
    if not count:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    diferenca = quantidade_contada - count["saldo_sistema"]
    await db.count_entries.update_one(
        {"id": count_id},
        {"$set": {"quantidade_contada": quantidade_contada, "diferenca": diferenca, "observacao": observacao}}
    )
    return {"message": "Atualizado"}


# ---- Dashboard ----

@api_router.get("/dashboard")
async def get_dashboard_stats(session_id: Optional[str] = Query(None)):
    total_items = await db.stock_items.count_documents({"ativo": True})
    total_sessions = await db.sessions.count_documents({})

    query: dict = {}
    if session_id:
        query["session_id"] = session_id
    counts = await db.count_entries.find(query, {"_id": 0}).to_list(10000)

    total_counted = len(counts)
    divergences = [c for c in counts if c["diferenca"] != 0]
    ok_count = total_counted - len(divergences)
    falta_count = len([c for c in counts if c["diferenca"] < 0])
    sobra_count = len([c for c in counts if c["diferenca"] > 0])

    sorted_div = sorted(divergences, key=lambda x: abs(x["diferenca"]), reverse=True)[:5]

    return {
        "total_items": total_items,
        "total_sessions": total_sessions,
        "total_counted": total_counted,
        "total_divergences": len(divergences),
        "ok_count": ok_count,
        "falta_count": falta_count,
        "sobra_count": sobra_count,
        "top_divergences": sorted_div,
    }


# ---- Export ----

@api_router.get("/export/csv/{session_id}")
async def export_session_csv(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    counts = await db.count_entries.find(
        {"session_id": session_id}, {"_id": 0}
    ).to_list(10000)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(["Código", "Descrição", "Saldo Sistema", "Contado", "Diferença",
                     "Localização", "Observação", "Data/Hora"])
    for c in counts:
        dt = c["created_at"]
        dt_str = dt.strftime("%d/%m/%Y %H:%M") if isinstance(dt, datetime) else str(dt)[:16]
        writer.writerow([
            c["codigo"], c["descricao"], c["saldo_sistema"],
            c["quantidade_contada"], c["diferenca"],
            c.get("localizacao", ""), c.get("observacao", ""), dt_str,
        ])

    output.seek(0)
    nome = session['nome'].replace(' ', '_')
    filename = f"contagem_{nome}_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ---- Health ----

@api_router.get("/")
async def root():
    return {"message": "EstoqueAudit API v2.0", "status": "ok"}


@api_router.get("/download/project")
async def download_project():
    """Download the EstoqueAudit project ZIP"""
    zip_path = Path(__file__).parent / "EstoqueAudit_v2.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo ZIP não encontrado.")
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename="EstoqueAudit_v2.zip",
        headers={"Content-Disposition": "attachment; filename=EstoqueAudit_v2.zip"}
    )


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_demo_data():
    count = await db.stock_items.count_documents({})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    demo_items = [
        {"id": str(uuid.uuid4()), "codigo": "7891234567890", "descricao": "RESINA PP HOMOPOLÍMERO",
         "categoria": "MATÉRIA-PRIMA", "unidade": "KG", "localizacao": "A-01",
         "saldo_sistema": 1200, "estoque_minimo": 500, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567891", "descricao": "MASTER AZUL CONCENTRADO",
         "categoria": "ADITIVOS", "unidade": "KG", "localizacao": "A-02",
         "saldo_sistema": 340, "estoque_minimo": 100, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567892", "descricao": "ADITIVO ANTIOXIDANTE UV",
         "categoria": "ADITIVOS", "unidade": "KG", "localizacao": "A-03",
         "saldo_sistema": 80, "estoque_minimo": 50, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567893", "descricao": "PIGMENTO VERDE INDUSTRIAL",
         "categoria": "PIGMENTOS", "unidade": "KG", "localizacao": "B-01",
         "saldo_sistema": 520, "estoque_minimo": 200, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567894", "descricao": "EMBALAGEM SACO 25KG",
         "categoria": "EMBALAGENS", "unidade": "UN", "localizacao": "C-01",
         "saldo_sistema": 3500, "estoque_minimo": 1000, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567895", "descricao": "CAIXA PAPELÃO 40X60",
         "categoria": "EMBALAGENS", "unidade": "UN", "localizacao": "C-02",
         "saldo_sistema": 1800, "estoque_minimo": 500, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567896", "descricao": "FITA ADESIVA 45MM MARROM",
         "categoria": "EMBALAGENS", "unidade": "RL", "localizacao": "C-03",
         "saldo_sistema": 200, "estoque_minimo": 50, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567897", "descricao": "PALLET PLÁSTICO PBR",
         "categoria": "EQUIPAMENTOS", "unidade": "UN", "localizacao": "D-01",
         "saldo_sistema": 45, "estoque_minimo": 20, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567898", "descricao": "LUVA NITRÍLICA P",
         "categoria": "EPI", "unidade": "PAR", "localizacao": "E-01",
         "saldo_sistema": 600, "estoque_minimo": 200, "ativo": True, "created_at": now, "updated_at": now},
        {"id": str(uuid.uuid4()), "codigo": "7891234567899", "descricao": "ÓCULOS PROTEÇÃO TRANSPARENTE",
         "categoria": "EPI", "unidade": "UN", "localizacao": "E-02",
         "saldo_sistema": 120, "estoque_minimo": 40, "ativo": True, "created_at": now, "updated_at": now},
    ]
    await db.stock_items.insert_many(demo_items)

    session_id = str(uuid.uuid4())
    await db.sessions.insert_one({
        "id": session_id, "nome": "Contagem Geral Jan/2025",
        "responsavel": "Operador Demo", "status": "aberta",
        "data_inicio": now, "data_fim": None, "created_at": now,
    })

    demo_counts = [
        {"id": str(uuid.uuid4()), "session_id": session_id, "codigo": "7891234567890",
         "descricao": "RESINA PP HOMOPOLÍMERO", "saldo_sistema": 1200, "quantidade_contada": 1185,
         "diferenca": -15, "localizacao": "A-01", "observacao": "", "escaneado": True, "created_at": now},
        {"id": str(uuid.uuid4()), "session_id": session_id, "codigo": "7891234567891",
         "descricao": "MASTER AZUL CONCENTRADO", "saldo_sistema": 340, "quantidade_contada": 340,
         "diferenca": 0, "localizacao": "A-02", "observacao": "", "escaneado": True, "created_at": now},
        {"id": str(uuid.uuid4()), "session_id": session_id, "codigo": "7891234567892",
         "descricao": "ADITIVO ANTIOXIDANTE UV", "saldo_sistema": 80, "quantidade_contada": 92,
         "diferenca": 12, "localizacao": "A-03", "observacao": "Material extra encontrado", "escaneado": True, "created_at": now},
        {"id": str(uuid.uuid4()), "session_id": session_id, "codigo": "7891234567894",
         "descricao": "EMBALAGEM SACO 25KG", "saldo_sistema": 3500, "quantidade_contada": 3420,
         "diferenca": -80, "localizacao": "C-01", "observacao": "Possível avaria", "escaneado": True, "created_at": now},
        {"id": str(uuid.uuid4()), "session_id": session_id, "codigo": "7891234567898",
         "descricao": "LUVA NITRÍLICA P", "saldo_sistema": 600, "quantidade_contada": 612,
         "diferenca": 12, "localizacao": "E-01", "observacao": "", "escaneado": False, "created_at": now},
    ]
    await db.count_entries.insert_many(demo_counts)
    logger.info("Demo data seeded successfully")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
