package expo.modules.inventorylabel

import android.content.Context
import android.graphics.pdf.PdfDocument
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.pdf.PrintedPdfDocument
import java.io.FileOutputStream
import kotlin.math.abs

internal class LabelPrintAdapter(
  private val context: Context,
  private val label: CountLabel
) : PrintDocumentAdapter() {
  private lateinit var attributes: PrintAttributes

  override fun onLayout(old: PrintAttributes?, new: PrintAttributes, signal: CancellationSignal,
                        callback: LayoutResultCallback, extras: Bundle?) {
    if (signal.isCanceled) { callback.onLayoutCancelled(); return }
    attributes = new
    val info = PrintDocumentInfo.Builder("UC-" + label.uc + ".pdf")
      .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(1).build()
    callback.onLayoutFinished(info, old != new)
  }

  override fun onWrite(pages: Array<out PageRange>, destination: ParcelFileDescriptor,
                       signal: CancellationSignal, callback: WriteResultCallback) {
    if (signal.isCanceled) { callback.onWriteCancelled(); return }
    if (pages.none { it.start <= 0 && it.end >= 0 }) {
      callback.onWriteFinished(emptyArray()); return
    }
    try {
      PrintedPdfDocument(context, attributes).use { document ->
        val page: PdfDocument.Page = document.startPage(0)
        val landscape = document.pageWidth > document.pageHeight
        val pointsPerDot = 72f / 203.2f  // 8 dots/mm
        val width = (if (landscape) 720 else 480) * pointsPerDot
        val height = (if (landscape) 480 else 720) * pointsPerDot
        val content = document.pageContentRect
        // PdfDocument canvases start at the top-left of the printable rectangle.
        val canvas = page.canvas
        canvas.save()
        // Draw at actual size. Larger office paper can be used for a proof.
        // On a nominal 60 × 90 page tolerate the integer rounding to PDF points.
        val left = if (abs(document.pageWidth - width) < 2f) -content.left.toFloat() else 0f
        val top = if (abs(document.pageHeight - height) < 2f) -content.top.toFloat() else 0f
        canvas.translate(left, top)
        canvas.scale(pointsPerDot, pointsPerDot)
        if (!landscape) { canvas.translate(480f, 0f); canvas.rotate(90f) }
        label.draw(canvas)
        canvas.restore()
        document.finishPage(page)
        require(document.pageWidth + 1 >= width && document.pageHeight + 1 >= height) {
          "Escolha a mídia de 60 × 90 mm no serviço de impressão."
        }
        if (signal.isCanceled) { callback.onWriteCancelled(); return }
        FileOutputStream(destination.fileDescriptor).use { document.writeTo(it) }
      }
      if (signal.isCanceled) callback.onWriteCancelled() else callback.onWriteFinished(arrayOf(PageRange(0, 0)))
    } catch (e: Exception) {
      callback.onWriteFailed(e.localizedMessage ?: "Falha ao preparar a etiqueta.")
    }
  }
}
