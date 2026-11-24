package expo.modules.inventorylabel

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import org.json.JSONObject
import kotlin.math.min

// Coordenadas em pontos físicos da cabeça térmica, 8 pontos por milímetro.
internal class CountLabel(payload: String, private val quantity: String) {
  private val fields = JSONObject(payload)
  val uc: String = fields.getString("uc")
  private val matrix = QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, 0, 0, mapOf(
    EncodeHintType.CHARACTER_SET to "UTF-8",
    EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
    EncodeHintType.MARGIN to 4
  ))
  private val qrPitch = min(284 / matrix.width, 7)
  init { require(qrPitch >= 2) { "Descrição muito longa para um QR legível nesta etiqueta." } }

  // Desenho horizontal 90 × 60 mm. O adaptador gira para bobina de 60 mm.
  fun draw(canvas: Canvas) {
    val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK }
    fun text(value: String, x: Int, y: Int, size: Int, bold: Boolean = false, maxWidth: Int = 680) {
      ink.typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
      ink.textSize = size.toFloat()
      while (ink.measureText(value) > maxWidth && ink.textSize > 14) ink.textSize -= 1f
      val end = ink.breakText(value, true, maxWidth.toFloat(), null)
      val shown = if (end < value.length) value.take((end - 1).coerceAtLeast(0)) + "…" else value
      canvas.drawText(shown, x.toFloat(), y.toFloat(), ink)
    }
    text("INVENTÁRIO GERAL", 24, 45, 28, true)
    canvas.drawRect(24f, 58f, 696f, 62f, ink)
    text("MATERIAL", 24, 100, 19)
    text(fields.getString("codigo"), 24, 143, 36, true, 371)
    ink.textSize = 24f
    ink.typeface = Typeface.DEFAULT
    var description = fields.getString("descricao").replace(Regex("\\s+"), " ").trim()
    for (line in 0..2) {
      if (description.isEmpty()) break
      ink.textSize = 24f
      val n = ink.breakText(description, true, 368f, null).coerceAtLeast(1)
      val space = if (n < description.length) description.lastIndexOf(' ', n) else -1
      val end = if (space > 0) space else n
      val shown = if (line == 2 && end < description.length) description.take((end - 1).coerceAtLeast(0)) + "…" else description.take(end)
      text(shown, 24, 184 + 30 * line, 24, maxWidth = 371)
      description = description.drop(end).trimStart()
    }
    text("QUANTIDADE", 24, 300, 19)
    text(quantity, 24, 355, 54, true, 372)
    val side = matrix.width * qrPitch
    val x0 = 408 + (284 - side) / 2
    val y0 = 78 + (284 - side) / 2
    val squares = Paint().apply {
      color = Color.BLACK
      isAntiAlias = false
    }
    for (y in 0 until matrix.height) for (x in 0 until matrix.width) {
      if (matrix[x, y]) canvas.drawRect((x0 + x * qrPitch).toFloat(), (y0 + y * qrPitch).toFloat(),
        (x0 + (x + 1) * qrPitch).toFloat(), (y0 + (y + 1) * qrPitch).toFloat(), squares)
    }
    canvas.drawRect(24f, 379f, 696f, 382f, ink)
    text("ENDEREÇO", 24, 411, 18)
    text(fields.getString("endereco"), 24, 450, 30, true, 355)
    text("UC", 408, 411, 18)
    text(uc, 408, 450, 32, true, 285)
  }
}
