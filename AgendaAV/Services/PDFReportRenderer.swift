import Foundation
import UIKit

enum PDFReportRenderer {
    private static let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
    private static let margin: CGFloat = 42

    static func makePDF(from summary: ReportSummary) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        return renderer.pdfData { context in
            var page = 1
            beginPage(context)
            var y = drawHeader(summary)

            y = drawSummaryCards(summary, y: y)
            y = drawMonthlyBreakdown(summary, y: y, context: context, page: &page)
            y = drawCompanyBreakdown(summary, y: y, context: context, page: &page)
            y = drawEventTable(summary, y: y, context: context, page: &page)
            drawFooter(page: page)
        }
    }

    static func suggestedFileName(for summary: ReportSummary) -> String {
        let start = summary.period.closedRange.lowerBound.formatted(.dateTime.year().month().day())
        return "Reporte-\(start).pdf"
    }

    // MARK: - Pages

    private static func beginPage(_ context: UIGraphicsPDFRendererContext) {
        context.beginPage()
    }

    private static func ensureSpace(
        _ needed: CGFloat,
        y: inout CGFloat,
        context: UIGraphicsPDFRendererContext,
        page: inout Int
    ) {
        let limit = pageRect.height - 56
        if y + needed > limit {
            drawFooter(page: page)
            page += 1
            beginPage(context)
            y = margin + 8
            drawContinuedHeader(page: page)
            y = margin + 36
        }
    }

    // MARK: - Header

    @discardableResult
    private static func drawHeader(_ summary: ReportSummary) -> CGFloat {
        let header = CGRect(x: 0, y: 0, width: pageRect.width, height: 92)
        UIColor(red: 0.07, green: 0.16, blue: 0.22, alpha: 1).setFill()
        UIRectFill(header)

        "REPORTE".draw(
            at: CGPoint(x: margin, y: 28),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 22, weight: .bold),
                .foregroundColor: UIColor.white
            ]
        )

        "Período: \(summary.periodTitle)".draw(
            at: CGPoint(x: margin, y: 64),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 12, weight: .regular),
                .foregroundColor: UIColor.white.withAlphaComponent(0.9)
            ]
        )

        let generated = "Generado \(Date.now.formatted(date: .abbreviated, time: .shortened))"
        let genFont = UIFont.systemFont(ofSize: 10, weight: .regular)
        let genWidth = (generated as NSString).size(withAttributes: [.font: genFont]).width
        generated.draw(
            at: CGPoint(x: pageRect.width - margin - genWidth, y: 66),
            withAttributes: [
                .font: genFont,
                .foregroundColor: UIColor.white.withAlphaComponent(0.7)
            ]
        )

        return header.maxY + 20
    }

    private static func drawContinuedHeader(page: Int) {
        "Reporte (cont.)  ·  pág. \(page)".draw(
            at: CGPoint(x: margin, y: margin),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 10, weight: .medium),
                .foregroundColor: UIColor.darkGray
            ]
        )
    }

    private static func drawFooter(page: Int) {
        let text = "Reporte  ·  \(page)"
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

    // MARK: - Summary

    private static func drawSummaryCards(_ summary: ReportSummary, y startY: CGFloat) -> CGFloat {
        let gap: CGFloat = 10
        let width = (pageRect.width - margin * 2 - gap * 2) / 3
        let height: CGFloat = 58
        let cards: [(String, String)] = [
            ("Trabajos", "\(summary.jobCount)"),
            (summary.period.kind == .yearly ? "Total del año" : "Total a cobrar", CurrencyFormat.string(from: summary.totalAmount)),
            (
                "Pendiente",
                "\(summary.payment.pendingCount) · \(CurrencyFormat.string(from: summary.payment.pendingAmount))"
            )
        ]

        for (index, card) in cards.enumerated() {
            let x = margin + CGFloat(index) * (width + gap)
            let rect = CGRect(x: x, y: startY, width: width, height: height)
            let path = UIBezierPath(roundedRect: rect, cornerRadius: 8)
            UIColor(white: 0.96, alpha: 1).setFill()
            path.fill()

            card.0.draw(
                at: CGPoint(x: rect.minX + 10, y: rect.minY + 10),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 10, weight: .medium),
                    .foregroundColor: UIColor.gray
                ]
            )
            card.1.draw(
                in: CGRect(x: rect.minX + 10, y: rect.minY + 26, width: width - 20, height: 24),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 13, weight: .semibold),
                    .foregroundColor: UIColor.black
                ]
            )
        }

        return startY + height + 22
    }

    // MARK: - Monthly breakdown

    private static func drawMonthlyBreakdown(
        _ summary: ReportSummary,
        y startY: CGFloat,
        context: UIGraphicsPDFRendererContext,
        page: inout Int
    ) -> CGFloat {
        guard !summary.monthlyRows.isEmpty else { return startY }
        var y = startY
        ensureSpace(28, y: &y, context: context, page: &page)
        "Ganado por mes".draw(
            at: CGPoint(x: margin, y: y),
            withAttributes: sectionAttributes
        )
        y += 22

        for row in summary.monthlyRows {
            ensureSpace(20, y: &y, context: context, page: &page)
            let jobs = row.jobCount == 0
                ? "Sin trabajos"
                : "\(row.jobCount) trabajo\(row.jobCount == 1 ? "" : "s")"
            "\(row.label)  ·  \(jobs)".draw(
                at: CGPoint(x: margin, y: y),
                withAttributes: bodyAttributes
            )
            let amount = CurrencyFormat.string(from: row.total)
            let amountWidth = (amount as NSString).size(withAttributes: [.font: UIFont.systemFont(ofSize: 11, weight: .semibold)]).width
            amount.draw(
                at: CGPoint(x: pageRect.width - margin - amountWidth, y: y),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
                    .foregroundColor: UIColor.black
                ]
            )
            y += 18
        }
        return y + 10
    }

    // MARK: - Company breakdown

    private static func drawCompanyBreakdown(
        _ summary: ReportSummary,
        y startY: CGFloat,
        context: UIGraphicsPDFRendererContext,
        page: inout Int
    ) -> CGFloat {
        var y = startY
        ensureSpace(28, y: &y, context: context, page: &page)
        "Desglose por empresa".draw(
            at: CGPoint(x: margin, y: y),
            withAttributes: sectionAttributes
        )
        y += 22

        if summary.byCompany.isEmpty {
            "Sin trabajos en este período.".draw(
                at: CGPoint(x: margin, y: y),
                withAttributes: bodyAttributes
            )
            return y + 24
        }

        for row in summary.byCompany {
            ensureSpace(20, y: &y, context: context, page: &page)
            let color = UIColor(hex: row.colorHex)
            let swatch = CGRect(x: margin, y: y + 3, width: 8, height: 8)
            color.setFill()
            UIBezierPath(ovalIn: swatch).fill()

            let line = "\(row.name)  ·  \(row.days) día\(row.days == 1 ? "" : "s")  ·  \(row.jobCount) trabajo\(row.jobCount == 1 ? "" : "s")"
            line.draw(
                at: CGPoint(x: margin + 16, y: y),
                withAttributes: bodyAttributes
            )

            let amount = CurrencyFormat.string(from: row.amount)
            let amountWidth = (amount as NSString).size(withAttributes: [.font: UIFont.systemFont(ofSize: 11, weight: .semibold)]).width
            amount.draw(
                at: CGPoint(x: pageRect.width - margin - amountWidth, y: y),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
                    .foregroundColor: UIColor.black
                ]
            )
            y += 18
        }

        ensureSpace(20, y: &y, context: context, page: &page)
        let paidLine = "Pagado: \(summary.payment.paidCount) · \(CurrencyFormat.string(from: summary.payment.paidAmount))     Pendiente: \(summary.payment.pendingCount) · \(CurrencyFormat.string(from: summary.payment.pendingAmount))"
        paidLine.draw(
            at: CGPoint(x: margin, y: y + 4),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 10, weight: .medium),
                .foregroundColor: UIColor.darkGray
            ]
        )
        return y + 28
    }

    // MARK: - Table

    private static func drawEventTable(
        _ summary: ReportSummary,
        y startY: CGFloat,
        context: UIGraphicsPDFRendererContext,
        page: inout Int
    ) -> CGFloat {
        var y = startY
        ensureSpace(40, y: &y, context: context, page: &page)
        "Lista de trabajos".draw(
            at: CGPoint(x: margin, y: y),
            withAttributes: sectionAttributes
        )
        y += 20

        y = drawTableHeader(y: y)

        if summary.events.isEmpty {
            "No hay trabajos en el período seleccionado.".draw(
                at: CGPoint(x: margin, y: y + 8),
                withAttributes: bodyAttributes
            )
            return y + 28
        }

        let columns = columnFrames()
        for (index, event) in summary.events.enumerated() {
            ensureSpace(22, y: &y, context: context, page: &page)
            if index % 2 == 0 {
                UIColor(white: 0.97, alpha: 1).setFill()
                UIRectFill(CGRect(x: margin, y: y - 3, width: pageRect.width - margin * 2, height: 20))
            }

            dateLabel(for: event).draw(in: CGRect(x: columns.date.minX, y: y, width: columns.date.width, height: 16), withAttributes: tableAttributes)
            (event.company?.name ?? "—").draw(in: CGRect(x: columns.company.minX, y: y, width: columns.company.width, height: 16), withAttributes: tableAttributes)
            event.projectName.draw(in: CGRect(x: columns.project.minX, y: y, width: columns.project.width, height: 16), withAttributes: tableAttributes)
            let amount = CurrencyFormat.string(from: event.billedAmount(in: summary.period.closedRange))
            let amountBox = CGRect(x: columns.amount.minX, y: y, width: columns.amount.width, height: 16)
            amount.draw(in: amountBox, withAttributes: tableRightAttributes)
            y += 20
        }

        ensureSpace(28, y: &y, context: context, page: &page)
        UIColor(white: 0.85, alpha: 1).setFill()
        UIRectFill(CGRect(x: margin, y: y, width: pageRect.width - margin * 2, height: 1))
        y += 10

        "TOTAL GENERAL".draw(
            at: CGPoint(x: margin, y: y),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 12, weight: .bold),
                .foregroundColor: UIColor.black
            ]
        )
        let total = CurrencyFormat.string(from: summary.totalAmount)
        let totalWidth = (total as NSString).size(withAttributes: [.font: UIFont.systemFont(ofSize: 13, weight: .bold)]).width
        total.draw(
            at: CGPoint(x: pageRect.width - margin - totalWidth, y: y),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 13, weight: .bold),
                .foregroundColor: UIColor.black
            ]
        )

        return y + 24
    }

    private static func drawTableHeader(y: CGFloat) -> CGFloat {
        let columns = columnFrames()
        UIColor(red: 0.07, green: 0.16, blue: 0.22, alpha: 1).setFill()
        UIRectFill(CGRect(x: margin, y: y, width: pageRect.width - margin * 2, height: 22))

        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: UIColor.white
        ]
        "Fecha".draw(at: CGPoint(x: columns.date.minX, y: y + 4), withAttributes: attrs)
        "Empresa".draw(at: CGPoint(x: columns.company.minX, y: y + 4), withAttributes: attrs)
        "Proyecto".draw(at: CGPoint(x: columns.project.minX, y: y + 4), withAttributes: attrs)
        "Monto".draw(at: CGPoint(x: columns.amount.minX, y: y + 4), withAttributes: attrs)
        return y + 28
    }

    private static func columnFrames() -> (date: CGRect, company: CGRect, project: CGRect, amount: CGRect) {
        let usable = pageRect.width - margin * 2
        let dateW: CGFloat = 118
        let companyW: CGFloat = 130
        let amountW: CGFloat = 90
        let projectW = usable - dateW - companyW - amountW
        let y: CGFloat = 0
        return (
            CGRect(x: margin + 6, y: y, width: dateW - 8, height: 16),
            CGRect(x: margin + dateW, y: y, width: companyW - 8, height: 16),
            CGRect(x: margin + dateW + companyW, y: y, width: projectW - 8, height: 16),
            CGRect(x: margin + dateW + companyW + projectW, y: y, width: amountW - 8, height: 16)
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

    private static var sectionAttributes: [NSAttributedString.Key: Any] {
        [
            .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
            .foregroundColor: UIColor.black
        ]
    }

    private static var bodyAttributes: [NSAttributedString.Key: Any] {
        [
            .font: UIFont.systemFont(ofSize: 11, weight: .regular),
            .foregroundColor: UIColor.darkGray
        ]
    }

    private static var tableAttributes: [NSAttributedString.Key: Any] {
        [
            .font: UIFont.systemFont(ofSize: 10, weight: .regular),
            .foregroundColor: UIColor.black
        ]
    }

    private static var tableRightAttributes: [NSAttributedString.Key: Any] {
        [
            .font: UIFont.systemFont(ofSize: 10, weight: .medium),
            .foregroundColor: UIColor.black,
            .paragraphStyle: {
                let style = NSMutableParagraphStyle()
                style.alignment = .right
                return style
            }()
        ]
    }
}
