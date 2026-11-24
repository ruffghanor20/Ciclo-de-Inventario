package expo.modules.inventorylabel

import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CountLabelTest {
  @Test
  fun qrDecodesFromFinalZebraRaster() {
    val payload = """{"codigo":"000123","descricao":"Conexão Ø 25 mm ^ ~ &","quantidade":11.125,"endereco":"R.13.11.D","uc":"0000000123"}"""
    val zpl = BluetoothPrinter.rasterZpl(CountLabel(payload, "11,125"))
    val header = "^GFA,43200,43200,60,"
    assertTrue(zpl.contains("^PW480^LL720"))
    val data = zpl.substringAfter(header).substringBefore("^FS")
    assertEquals(480 * 720 / 4, data.length)
    val pixels = IntArray(480 * 720) { i ->
      if (data[i / 4].digitToInt(16) and (8 shr (i % 4)) != 0) 0xff000000.toInt() else -1
    }
    val binary = BinaryBitmap(HybridBinarizer(RGBLuminanceSource(480, 720, pixels)))
    assertEquals(payload, QRCodeReader().decode(binary).text)
  }
}
