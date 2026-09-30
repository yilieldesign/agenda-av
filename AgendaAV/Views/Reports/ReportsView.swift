import SwiftData
import SwiftUI
import UIKit
import PDFKit

struct ReportsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \WorkEvent.startDate) private var events: [WorkEvent]
    @State private var period = ReportPeriod()
    @State private var pdfDocument: ReportPDFFile?
    @State private var previewDocument: ReportPDFFile?
    @State private var companyToPay: CompanyBreakdown?
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
                    if period.kind == .yearly {
                        monthlyBreakdownCard
                    }
                    invoiceProfileCard
                    companyBreakdown
                    historyBreakdown
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
            .sheet(item: $previewDocument) { file in
                NavigationStack {
                    PDFPreviewView(url: file.url)
                        .ignoresSafeArea(edges: .bottom)
                        .navigationTitle("Vista previa")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Cerrar") { previewDocument = nil }
                            }
                        }
                }
            }
            .alert(
                "Pago por empresa",
                isPresented: Binding(
                    get: { companyToPay != nil },
                    set: { if !$0 { companyToPay = nil } }
                )
            ) {
                Button("Cancelar", role: .cancel) { companyToPay = nil }
                Button("Marcar pagado") {
                    if let row = companyToPay {
                        markCompanyPaid(row)
                    }
                    companyToPay = nil
                }
            } message: {
                Text("Los trabajos pendientes de \(companyToPay?.name ?? "esta empresa") salen de Pendiente y quedan en el historial.")
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
            case .yearly:
                yearStepper
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

    private var yearStepper: some View {
        HStack {
            Button {
                shiftYear(-1)
            } label: {
                Image(systemName: "chevron.left.circle.fill")
            }
            Spacer()
            Text(String(Calendar.current.component(.year, from: period.monthAnchor)))
                .font(.headline)
            Spacer()
            Button {
                shiftYear(1)
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
            metricTile(title: period.kind == .yearly ? "Total del año" : "Total a cobrar", value: CurrencyFormat.string(from: summary.totalAmount), systemImage: "banknote.fill")
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

    private var monthlyBreakdownCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ganado por mes")
                .font(.headline)
            Text("El cobro completo se cuenta en el mes en que empieza el trabajo. Toca un mes para ver el detalle.")
                .font(.caption)
                .foregroundStyle(.secondary)

            ForEach(summary.monthlyRows) { row in
                Button {
                    period.kind = .monthly
                    period.monthAnchor = row.start
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                            Text(row.jobCount == 0 ? "Sin trabajos" : "\(row.jobCount) trabajo\(row.jobCount == 1 ? "" : "s")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(CurrencyFormat.string(from: row.total))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
                if row.id != summary.monthlyRows.last?.id {
                    Divider()
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

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

    private var pendingCompanyRows: [CompanyBreakdown] {
        summary.byCompany.filter { !companyEvents($0, status: .pending).isEmpty }
    }

    private var paidCompanyRows: [CompanyBreakdown] {
        summary.byCompany.filter { !companyEvents($0, status: .paid).isEmpty }
    }

    private var companyBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pendiente por empresa")
                .font(.headline)
            Text("Aquí solo salen los cobros que faltan. Cuando te paguen, usa Pago por empresa: salen de esta lista y quedan en el historial.")
                .font(.caption)
                .foregroundStyle(.secondary)

            if pendingCompanyRows.isEmpty {
                Text("No hay cobros pendientes en este período.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(pendingCompanyRows) { row in
                    companyInvoiceBlock(row, mode: .pending)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
    }

    private var historyBreakdown: some View {
        Group {
            if !paidCompanyRows.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Historial")
                        .font(.headline)
                    Text("Trabajos ya cobrados. No entran en pendientes; sirven para ver lo ganado.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(paidCompanyRows) { row in
                        companyInvoiceBlock(row, mode: .history)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.background, in: RoundedRectangle(cornerRadius: AVStyle.cardCorner, style: .continuous))
            }
        }
    }

    private enum CompanyBlockMode {
        case pending
        case history
    }

    private func companyInvoiceBlock(_ row: CompanyBreakdown, mode: CompanyBlockMode) -> some View {
        let jobs = companyEvents(row, status: mode == .pending ? .pending : .paid)
        let total = jobs.reduce(Decimal.zero) { $0 + $1.billedAmount(in: period.closedRange) }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Circle()
                    .fill(Color(hex: row.colorHex))
                    .frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name)
                        .font(.subheadline.weight(.semibold))
                    Text("\(jobs.count) trabajo\(jobs.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(CurrencyFormat.string(from: total))
                    .font(.subheadline.weight(.semibold))
            }

            ForEach(jobs, id: \.uuid) { event in
                HStack(alignment: .firstTextBaseline) {
                    Text(invoiceDate(event))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 88, alignment: .leading)
                    Text(event.reportLabel)
                        .font(.caption)
                        .lineLimit(2)
                    Spacer()
                    Text(CurrencyFormat.string(from: event.billedAmount(in: period.closedRange)))
                        .font(.caption.weight(.semibold))
                }
            }

            HStack {
                Text("Total")
                Spacer()
                Text(CurrencyFormat.string(from: total))
            }
            .font(.subheadline.weight(.bold))
            .padding(.top, 4)

            if mode == .pending {
                HStack {
                    Text("Pendiente de pago")
                    Spacer()
                    Text(CurrencyFormat.string(from: total))
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.orange)

                Button {
                    previewInvoice(for: row)
                } label: {
                    Label("Vista previa", systemImage: "eye")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .padding(.top, 4)

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
                        Label("Reporte PDF", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }

                Button {
                    companyToPay = row
                } label: {
                    Text("Pago por empresa")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.green)
            } else {
                HStack {
                    Text("Pagado · historial")
                    Spacer()
                    Text(CurrencyFormat.string(from: total))
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.green)
            }
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
                    VStack(alignment: .leading, spacing: 4) {
                        WorkEventRow(event: event)
                        Text(event.paymentStatus == .paid ? "Historial" : "Pendiente")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(event.paymentStatus == .paid ? .green : .orange)
                    }
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
            Text("Mira el informe, imprímelo o envíalo como PDF.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button {
                previewPDF()
            } label: {
                Label("Vista previa", systemImage: "eye")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            HStack(spacing: 12) {
                Button {
                    sharePDF()
                } label: {
                    Label("Reporte PDF", systemImage: "square.and.arrow.up")
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

    private func shiftYear(_ value: Int) {
        if let next = Calendar.current.date(byAdding: .year, value: value, to: period.monthAnchor) {
            period.monthAnchor = next
        }
    }

    private func makePDFData() -> Data {
        PDFReportRenderer.makePDF(from: summary)
    }

    private func writePDF(_ data: Data, fileName: String) -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }

    private func sharePDF() {
        guard let url = writePDF(makePDFData(), fileName: PDFReportRenderer.suggestedFileName(for: summary)) else { return }
        pdfDocument = ReportPDFFile(url: url)
    }

    private func previewPDF() {
        guard let url = writePDF(makePDFData(), fileName: PDFReportRenderer.suggestedFileName(for: summary)) else { return }
        previewDocument = ReportPDFFile(url: url)
    }

    private func printPDF() {
        let data = makePDFData()
        presentPrint(data, jobName: "Reporte")
    }

    private func companyEvents(_ row: CompanyBreakdown, status: PaymentStatus? = nil) -> [WorkEvent] {
        summary.events
            .filter { ($0.company?.uuid.uuidString ?? "sin-empresa") == row.companyID }
            .filter { status == nil || $0.paymentStatus == status }
            .sorted { $0.startDate < $1.startDate }
    }

    private func markCompanyPaid(_ row: CompanyBreakdown) {
        for event in companyEvents(row, status: .pending) {
            event.paymentStatus = .paid
        }
        try? modelContext.save()
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
            events: companyEvents(row, status: .pending),
            range: period.closedRange,
            issuer: InvoiceIssuer(
                name: invoiceName,
                phone: invoicePhone,
                paymentNote: invoicePayment
            )
        )
    }

    private func shareInvoice(for row: CompanyBreakdown) {
        guard let url = writePDF(
            invoiceData(for: row),
            fileName: InvoicePDFRenderer.suggestedFileName(companyName: row.name)
        ) else { return }
        pdfDocument = ReportPDFFile(url: url)
    }

    private func previewInvoice(for row: CompanyBreakdown) {
        guard let url = writePDF(
            invoiceData(for: row),
            fileName: InvoicePDFRenderer.suggestedFileName(companyName: row.name)
        ) else { return }
        previewDocument = ReportPDFFile(url: url)
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

struct PDFPreviewView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.document = PDFDocument(url: url)
        return view
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        uiView.document = PDFDocument(url: url)
    }
}

#Preview {
    ReportsView()
        .modelContainer(PreviewSampleData.container)
}
