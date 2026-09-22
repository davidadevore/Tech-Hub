// Regenerate checked-in PNGs with: swift scripts/generate-app-icon.swift
// Coordinates match assets/tech-hub.svg; no installed fonts are required.
import AppKit
let output = "assets/TechHub.iconset"
try FileManager.default.createDirectory(atPath: output, withIntermediateDirectories: true)
for size in [16, 32, 64, 128, 256, 512, 1024] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let transform = AffineTransform(scale: CGFloat(size) / 256)
    (transform as NSAffineTransform).concat()
    NSColor(srgbRed: 7/255, green: 16/255, blue: 21/255, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 8, y: 8, width: 240, height: 240), xRadius: 48, yRadius: 48).fill()
    NSColor(srgbRed: 1, green: 138/255, blue: 31/255, alpha: 1).setFill()
    for points: [(CGFloat, CGFloat)] in [
        [(38,76),(118,76),(118,100),(90,100),(90,180),(66,180),(66,100),(38,100)],
        [(134,76),(158,76),(158,116),(194,116),(194,76),(218,76),(218,180),(194,180),(194,140),(158,140),(158,180),(134,180)]
    ] {
        let shape = NSBezierPath()
        shape.move(to: NSPoint(x: points[0].0, y: 256-points[0].1))
        for (x,y) in points.dropFirst() { shape.line(to: NSPoint(x: x, y: 256-y)) }
        shape.close(); shape.fill()
    }
    NSGraphicsContext.restoreGraphicsState()
    let png = bitmap.representation(using: .png, properties: [:])!
    if size <= 512 { try png.write(to: URL(fileURLWithPath: "\(output)/icon_\(size)x\(size).png")) }
    if size >= 32 { try png.write(to: URL(fileURLWithPath: "\(output)/icon_\(size/2)x\(size/2)@2x.png")) }
}
