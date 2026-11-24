package expo.modules.inventorylabel

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class InventoryLabelModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InventoryLabel")
    AsyncFunction("paired") {
      BluetoothPrinter.paired(requireNotNull(appContext.reactContext))
    }
    AsyncFunction("sendBluetooth") { payload: String, quantity: String, address: String ->
      BluetoothPrinter.send(requireNotNull(appContext.reactContext), address, CountLabel(payload, quantity))
    }
    AsyncFunction("print") { payload: String, displayQuantity: String ->
      val activity = appContext.currentActivity ?: error("Reabra o coletor para imprimir.")
      val label = CountLabel(payload, displayQuantity)
      val manager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager
        ?: error("Serviço de impressão indisponível no coletor.")
      val attributes = PrintAttributes.Builder()
        .setMediaSize(PrintAttributes.MediaSize("ZQ510_60_90", "60 × 90 mm", 2362, 3543))
        .setResolution(PrintAttributes.Resolution("ZQ510_203", "203 dpi", 203, 203))
        .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
        .build()
      manager.print("Contagem " + label.uc, LabelPrintAdapter(activity, label), attributes)
      Unit
    }.runOnQueue(Queues.MAIN)
  }
}
