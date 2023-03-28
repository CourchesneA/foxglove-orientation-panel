import { ExtensionContext } from "@foxglove/studio";
import { initOrientationPanel } from "./OrientationPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "Orientation", initPanel: initOrientationPanel });
}
