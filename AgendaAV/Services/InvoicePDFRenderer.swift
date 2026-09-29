import Foundation
import UIKit

struct InvoiceIssuer {
    var name: String
    var phone: String
    var paymentNote: String
}

enum InvoicePDFRenderer {
    private static let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
    private static let margin: CGFloat = 42

    static func makePDF(
        companyName: String,
        periodTitle: String,
        events: [WorkEvent],
        issuer: InvoiceIssuer
    ) -> Data {
        let total = events.reduce(Decimal.zero) { $0 + $1.billedAmount }

        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        return renderer.pdfData { context in
            var page = 1
            context.beginPage()
            var y = drawHeader()

            y = drawParties(companyName: companyName, periodTitle: periodTitle, issuer: issuer, y: y)
            y = drawTable(
                events: events,
                total: total,
                issuer: issuer,
                y: y,
                context: context,
                page: &page
            )
            drawFooter(page: page)
        }
    }

    static func suggestedFileName(companyName: String) -> String {
        "Factura-\(fileSlug(companyName: companyName)).pdf"
    }

    private static func fileSlug(companyName: String) -> String {
        let slug = companyName
            .uppercased()
            .unicodeScalars
            .filter { CharacterSet.alphanumerics.contains($0) }
            .prefix(18)
        return String(slug).isEmpty ? "cliente" : String(slug)
    }

    private static func drawHeader() -> CGFloat {
        let header = CGRect(x: 0, y: 0, width: pageRect.width, height: 100)
        UIColor(red: 0.07, green: 0.16, blue: 0.22, alpha: 1).setFill()
        UIRectFill(header)

        "AGENDA AV".draw(
            at: CGPoint(x: margin, y: 18),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
                .foregroundColor: UIColor.white.withAlphaComponent(0.7)
            ]
        )
        "FACTURA".draw(
            at: CGPoint(x: margin, y: 38),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 24, weight: .bold),
                .foregroundColor: UIColor.white
            ]
        )
        Date.now.formatted(date: .long, time: .omitted).draw(
            at: CGPoint(x: margin, y: 70),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 11, weight: .regular),
                .foregroundColor: UIColor.white.withAlphaComponent(0.9)
            ]
        )
        return header.maxY + 22
    }

    private static func drawParties(
        companyName: String,
        periodTitle: String,
        issuer: InvoiceIssuer,
        y startY: CGFloat
    ) -> CGFloat {
        var y = startY
        let muted: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: UIColor.gray
        ]
        let body: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 12, weight: .regular),
            .foregroundColor: UIColor.black
        ]

        "DE".draw(at: CGPoint(x: margin, y: y), withAttributes: muted)
        y += 14
        let fromName = issuer.name.isEmpty ? "Servicios audiovisuales freelance" : issuer.name
        fromName.draw(at: CGPoint(x: margin, y: y), withAttributes: body)
        y += 16
        if !issuer.phone.isEmpty {
            issuer.phone.draw(at: CGPoint(x: margin, y: y), withAttributes: body)
            y += 16
        }

        "PARA".draw(at: CGPoint(x: margin, y: y + 4), withAttributes: muted)
        y += 20
        companyName.draw(
            at: CGPoint(x: margin, y: y),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
                .foregroundColor: UIColor.black
            ]
        )
        y += 20
        "Período: \(periodTitle)".draw(at: CGPoint(x: margin, y: y), withAttributes: body)
        return y + 24
    }

    private static func drawTable(
        events: [WorkEvent],
        total: Decimal,
        issuer: InvoiceIssuer,
        y startY: CGFloat,
        context: UIGraphicsPDFRendererContext,
        page: inout Int
    ) -> CGFloat {
        var y = startY
        y = drawTableHeader(y: y)

        if events.isEmpty {
            "No hay trabajos en este período.".draw(
                at: CGPoint(x: margin, y: y),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 11),
                    .foregroundColor: UIColor.darkGray
                ]
            )
            return y + 20
        }

        for (index, event) in events.enumerated() {
            if y + 22 > pageRect.height - 64 {
                drawFooter(page: page)
                page += 1
                context.beginPage()
                y = margin + 24
                y = drawTableHeader(y: y)
            }
            if index % 2 == 0 {
                UIColor(white: 0.97, alpha: 1).setFill()
                UIRectFill(CGRect(x: margin, y: y - 3, width: pageRect.width - margin * 2, height: 20))
            }
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10, weight: .regular),
                .foregroundColor: UIColor.black
            ]
            dateLabel(for: event).draw(in: CGRect(x: margin + 6, y: y, width: 110, height: 16), withAttributes: attrs)
            event.projectName.draw(in: CGRect(x: margin + 120, y: y, width: 210, height: 16), withAttributes: attrs)
            event.paymentStatus.title.draw(in: CGRect(x: margin + 334, y: y, width: 70, height: 16), withAttributes: attrs)
            let amount = CurrencyFormat.string(from: event.billedAmount)
            let amountWidth = (amount as NSString).size(withAttributes: [.font: UIFont.systemFont(ofSize: 10, weight: .semibold)]).width
            amount.draw(
                at: CGPoint(x: pageRect.width - margin - amountWidth, y: y),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
                    .foregroundColor: UIColor.black
                ]
            )
            y += 20
        }

        y += 10
        UIColor(white: 0.85, alpha: 1).setFill()
        UIRectFill(CGRect(x: margin, y: y, width: pageRect.width - margin * 2, height: 1))
        y += 12

        drawAmountRow(title: "TOTAL", value: CurrencyFormat.string(from: total), y: y, bold: true)
        y += 28

        if !issuer.paymentNote.isEmpty {
            "Instrucciones de pago".draw(
                at: CGPoint(x: margin, y: y),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
                    .foregroundColor: UIColor.gray
                ]
            )
            y += 14
            issuer.paymentNote.draw(
                in: CGRect(x: margin, y: y, width: pageRect.width - margin * 2, height: 48),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 11),
                    .foregroundColor: UIColor.black
                ]
            )
            y += 52
        }

        "Documento generado para cobro de servicios audiovisuales.".draw(
            at: CGPoint(x: margin, y: y),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 9),
                .foregroundColor: UIColor.gray
            ]
        )
        return y + 16
    }

    private static func drawTableHeader(y: CGFloat) -> CGFloat {
        UIColor(red: 0.07, green: 0.16, blue: 0.22, alpha: 1).setFill()
        UIRectFill(CGRect(x: margin, y: y, width: pageRect.width - margin * 2, height: 22))
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: UIColor.white
        ]
        "Fecha".draw(at: CGPoint(x: margin + 6, y: y + 4), withAttributes: attrs)
        "Trabajo".draw(at: CGPoint(x: margin + 120, y: y + 4), withAttributes: attrs)
        "Estado".draw(at: CGPoint(x: margin + 334, y: y + 4), withAttributes: attrs)
        "Monto".draw(at: CGPoint(x: margin + 430, y: y + 4), withAttributes: attrs)
        return y + 28
    }

    private static func drawAmountRow(title: String, value: String, y: CGFloat, bold: Bool) {
        title.draw(
            at: CGPoint(x: margin, y: y),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: bold ? 12 : 11, weight: bold ? .bold : .medium),
                .foregroundColor: UIColor.black
            ]
        )
        let font = UIFont.systemFont(ofSize: bold ? 13 : 11, weight: .bold)
        let width = (value as NSString).size(withAttributes: [.font: font]).width
        value.draw(
            at: CGPoint(x: pageRect.width - margin - width, y: y),
            withAttributes: [
                .font: font,
                .foregroundColor: UIColor.black
            ]
        )
    }

    private static func dateLabel(for event: WorkEvent) -> String {
        let start = event.startDate.formatted(.dateTime.day().month(.abbreviated))
        if event.isMultiDay {
            let end = event.endDate.formatted(.dateTime.day().month(.abbreviated))
            return "\(start) – \(end)"
        }
        return start
    }

    private static func drawFooter(page: Int) {
        let text = "Agenda AV  ·  Factura de servicios  ·  \(page)"
        let font = UIFont.systemFont(ofSize: 9, weight: .regular)
        let width = (text as NSString).size(withAttributes: [.font: font]).width
        text.draw(
            at: CGPoint(x: (pageRect.width - width) / 2, y: pageRect.height - 28),
            withAttributes: [
                .font: font,
                .foregroundColor: UIColor.gray
            ]
        )
    }
}
