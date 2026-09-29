import SwiftData
import SwiftUI
import UIKit

struct ReportsView: View {
    @Query(sort: \WorkEvent.startDate) private var events: [WorkEvent]
    @State private var period = ReportPeriod()
    @State private var pdfDocument: ReportPDFFile?
    @AppStorage("invoiceIssuerName") private var invoiceName = ""
    @AppStorage("invoiceIssuerPhone") private var invoicePhone = ""
    @AppStorage("invoicePaymentNote") private var invoicePayment = ""

    private var summary: ReportSummary {
        ReportCalculator.summarize(events: events, period: period)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    periodCard
                    totalsGrid
                    invoiceProfileCard
                    companyBreakdown
                    paymentBreakdown
                    jobsList
                    exportCard
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Reportes")
            .sheet(item: $pdfDocument) { file in
                ShareSheet(activityItems: [file.url])
            }
        }
    }

    // MARK: - Period

    private var periodCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("Tipo de período", selection: $period.kind) {
                ForEach(ReportKind.allCases) { kind in
                    Text(kind.title).tag(kind)
                }
            }
            .pickerStyle(.segmented)

            switch period.kind {
            case .monthly:
                monthStepper
            case .biweekly:
                monthStepper
                Picker("Quincena", selection: $period.biweeklyMode) {
                    ForEach(BiweeklyMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.menu)
                if period.biweeklyMode == .rolling15 {
                    DatePicker("Desde", selection: $period.customStart, displayedComponents: .date)
                }
            case .custom:
                DatePicker("Desde", selection: $period.customStart, displayedComponents: .date)
                DatePicker("Hasta", selection: $period.customEnd, displayedComponents: .date)
            }

            Text(period.title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private var monthStepper: some View {
        HStack {
            Button {
                shiftMonth(-1)
            } label: {
                Image(systemName: "chevron.left.circle.fill")
            }
            Spacer()
            Text(period.monthAnchor.formatted(.dateTime.month(.wide).year()))
                .font(.headline)
            Spacer()
            Button {
                shiftMonth(1)
            } label: {
                Image(systemName: "chevron.right.circle.fill")
            }
        }
        .foregroundStyle(.primary)
    }

    // MARK: - Totals

    private var totalsGrid: some View {
        let columns = [GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: columns, spacing: 12) {
            metricTile(title: "Trabajos", value: "\(summary.jobCount)", systemImage: "briefcase.fill")
            metricTile(title: "Total a cobrar", value: CurrencyFormat.string(from: summary.totalAmount), systemImage: "banknote.fill")
            metricTile(title: "Pagado", value: CurrencyFormat.string(from: summary.payment.paidAmount), systemImage: "checkmark.circle.fill")
            metricTile(title: "Pendiente", value: CurrencyFormat.string(from: summary.payment.pendingAmount), systemImage: "clock.badge.exclamationmark")
        }
    }

    private func metricTile(title: String, value: String, systemImage: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.bold))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: - Breakdowns

    private var invoiceProfileCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Tus datos en la factura")
                .font(.headline)
            Text("Aparecen en el PDF que envías a la empresa para cobro.")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("Tu nombre o razón", text: $invoiceName)
            TextField("Teléfono (opcional)", text: $invoicePhone)
            TextField("Datos de pago: banco, cuenta, Zelle…", text: $invoicePayment, axis: .vertical)
                .lineLimit(2...4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private var companyBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Desglose por empresa")
                .font(.headline)
            Text("Trabajos por fecha, monto y total. Genera una factura PDF para enviar y que te paguen.")
                .font(.caption)
                .foregroundStyle(.secondary)

            if summary.byCompany.isEmpty {
                Text("No hay trabajos en este período.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(summary.byCompany) { row in
                    companyInvoiceBlock(row)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private func companyInvoiceBlock(_ row: CompanyBreakdown) -> some View {
        let jobs = companyEvents(row)
        let pending = jobs.filter { $0.paymentStatus == .pending }.reduce(Decimal.zero) { $0 + $1.billedAmount }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Circle()
                    .fill(Color(hex: row.colorHex))
                    .frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name)
                        .font(.subheadline.weight(.semibold))
                    Text("\(row.days) día\(row.days == 1 ? "" : "s") · \(row.jobCount) trabajo\(row.jobCount == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(CurrencyFormat.string(from: row.amount))
                    .font(.subheadline.weight(.semibold))
            }

            ForEach(jobs, id: \.uuid) { event in
                HStack(alignment: .firstTextBaseline) {
                    Text(invoiceDate(event))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 88, alignment: .leading)
                    Text(event.projectName)
                        .font(.caption)
                        .lineLimit(2)
                    Spacer()
                    Text(CurrencyFormat.string(from: event.billedAmount))
                        .font(.caption.weight(.semibold))
                }
            }

            HStack {
                Text("Total")
                Spacer()
                Text(CurrencyFormat.string(from: row.amount))
            }
            .font(.subheadline.weight(.bold))
            .padding(.top, 4)

            HStack {
                Text("Pendiente de pago")
                Spacer()
                Text(CurrencyFormat.string(from: pending))
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.orange)

            HStack(spacing: 8) {
                Button {
                    printInvoice(for: row)
                } label: {
                    Label("Imprimir", systemImage: "printer")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button {
                    shareInvoice(for: row)
                } label: {
                    Label("Reporte PDF", systemImage: "doc.richtext")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.top, 4)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var paymentBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Desglose por estado")
                .font(.headline)
            statusRow(title: "Pagado", count: summary.payment.paidCount, amount: summary.payment.paidAmount, color: .green)
            statusRow(title: "Pendiente", count: summary.payment.pendingCount, amount: summary.payment.pendingAmount, color: .orange)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private func statusRow(title: String, count: Int, amount: Decimal, color: Color) -> some View {
        HStack {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(title)
            Text("· \(count)")
                .foregroundStyle(.secondary)
            Spacer()
            Text(CurrencyFormat.string(from: amount))
                .fontWeight(.semibold)
        }
        .font(.subheadline)
    }

    private var jobsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trabajos del período")
                .font(.headline)
            if summary.events.isEmpty {
                Text("Ajusta el rango para ver resultados.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(summary.events, id: \.uuid) { event in
                    WorkEventRow(event: event)
                    if event.uuid != summary.events.last?.uuid {
                        Divider()
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private var exportCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Exportar e imprimir")
                .font(.headline)
            Text("Genera un PDF listo para imprimir o enviarlo por WhatsApp, Mail u otra app.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Button {
                    sharePDF()
                } label: {
                    Label("Compartir PDF", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                Button {
                    printPDF()
                } label: {
                    Label("Imprimir", systemImage: "printer")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    // MARK: - Actions

    private func shiftMonth(_ value: Int) {
        if let next = Calendar.current.date(byAdding: .month, value: value, to: period.monthAnchor) {
            period.monthAnchor = next
        }
    }

    private func makePDFData() -> Data {
        PDFReportRenderer.makePDF(from: summary)
    }

    private func sharePDF() {
        let data = makePDFData()
        let fileName = PDFReportRenderer.suggestedFileName(for: summary)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: url, options: .atomic)
            pdfDocument = ReportPDFFile(url: url)
        } catch {
            // Si falla la escritura, no se presenta el share sheet.
        }
    }

    private func printPDF() {
        let data = makePDFData()
        presentPrint(data, jobName: "Reporte")
    }

    private func companyEvents(_ row: CompanyBreakdown) -> [WorkEvent] {
        summary.events
            .filter { ($0.company?.uuid.uuidString ?? "sin-empresa") == row.companyID }
            .sorted { $0.startDate < $1.startDate }
    }

    private func invoiceDate(_ event: WorkEvent) -> String {
        let start = event.startDate.formatted(.dateTime.day().month(.abbreviated))
        if event.isMultiDay {
            let end = event.endDate.formatted(.dateTime.day().month(.abbreviated))
            return "\(start) – \(end)"
        }
        return start
    }

    private func invoiceData(for row: CompanyBreakdown) -> Data {
        InvoicePDFRenderer.makePDF(
            companyName: row.name,
            periodTitle: summary.periodTitle,
            events: companyEvents(row),
            issuer: InvoiceIssuer(
                name: invoiceName,
                phone: invoicePhone,
                paymentNote: invoicePayment
            )
        )
    }

    private func shareInvoice(for row: CompanyBreakdown) {
        let data = invoiceData(for: row)
        let fileName = InvoicePDFRenderer.suggestedFileName(companyName: row.name)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: url, options: .atomic)
            pdfDocument = ReportPDFFile(url: url)
        } catch {
            return
        }
    }

    private func printInvoice(for row: CompanyBreakdown) {
        presentPrint(invoiceData(for: row), jobName: "Reporte \(row.name)")
    }

    private func presentPrint(_ data: Data, jobName: String) {
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo.printInfo()
        info.jobName = jobName
        info.outputType = .general
        controller.printInfo = info
        controller.printingItem = data
        controller.present(animated: true)
    }
}

struct ReportPDFFile: Identifiable {
    let id = UUID()
    let url: URL
}

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    ReportsView()
        .modelContainer(PreviewSampleData.container)
}
