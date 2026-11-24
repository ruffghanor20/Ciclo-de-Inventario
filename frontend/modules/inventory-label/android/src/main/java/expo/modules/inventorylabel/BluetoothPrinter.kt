package expo.modules.inventorylabel

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@SuppressLint("MissingPermission") // BLUETOOTH_CONNECT é solicitado pela tela antes de acessar aparelhos pareados.
internal object BluetoothPrinter {
  private val serial = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")
  private val hex = "0123456789ABCDEF"
  private fun adapter(context: Context) =
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
      ?.takeIf { it.isEnabled } ?: error("Ative o Bluetooth do coletor.")

  fun paired(context: Context): List<Map<String, String>> =
    adapter(context).bondedDevices.map { mapOf("name" to (it.name ?: it.address), "address" to it.address) }
      .sortedBy { it["name"] }

  fun send(context: Context, address: String, label: CountLabel) {
    val device = adapter(context).bondedDevices.firstOrNull { it.address == address }
      ?: error("Impressora não encontrada entre os dispositivos pareados.")
    val data = rasterZpl(label).toByteArray(Charsets.US_ASCII)
    val timer = Executors.newSingleThreadScheduledExecutor()
    try {
      device.createRfcommSocketToServiceRecord(serial).use { socket ->
        val deadline = timer.schedule({ try { socket.close() } catch (_: IOException) { } }, 20, TimeUnit.SECONDS)
        try {
          socket.connect()
          socket.outputStream.write(data)
          socket.outputStream.flush()
        } finally { deadline.cancel(false) }
      }
    } finally { timer.shutdownNow() }
  }

  internal fun rasterZpl(label: CountLabel): String {
    val width = 480
    val height = 720
    val image = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    try {
      val canvas = Canvas(image)
      canvas.drawColor(Color.WHITE)
      canvas.translate(width.toFloat(), 0f)
      canvas.rotate(90f)
      label.draw(canvas)
      val bytesPerRow = width / 8
      val byteCount = bytesPerRow * height
      val row = IntArray(width)
      return buildString(byteCount * 2 + 80) {
        append("^XA^LH0,0^FWN^PON^PW480^LL720^FO0,0^GFA,$byteCount,$byteCount,$bytesPerRow,")
        for (y in 0 until height) {
          image.getPixels(row, 0, width, 0, y, width, 1)
          for (start in 0 until width step 8) {
            var value = 0
            for (i in 0..7) {
              value = (value shl 1) or (if (Color.red(row[start + i]) < 128) 1 else 0)
            }
            append(hex[value ushr 4]); append(hex[value and 15])
          }
        }
        append("^FS^PQ1^XZ")
      }
    } finally { image.recycle() }
  }
}
