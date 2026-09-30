import Foundation
import SwiftData

@MainActor
enum PreviewSampleData {
    static var container: ModelContainer = {
        let container = try! PersistenceController.makeContainer(inMemory: true)
        seed(into: container.mainContext)
        return container
    }()

    static func seed(into context: ModelContext) {
        DefaultCatalog.ensure(in: context)
        let companies = (try? context.fetch(FetchDescriptor<Company>())) ?? []
        func company(_ name: String) -> Company? {
            companies.first { $0.name.compare(name, options: .caseInsensitive) == .orderedSame }
        }

        let calendar = Calendar.current
        let monthStart = calendar.startOfMonth(for: .now)
        func day(_ offset: Int) -> Date {
            calendar.date(byAdding: .day, value: offset, to: monthStart) ?? .now
        }

        let samples = [
            WorkEvent(
                startDate: day(2),
                endDate: day(2),
                projectName: "Sonidista",
                amount: 8_500,
                paymentStatus: .paid,
                notes: "GrabandoRD — consola y radio.",
                activityName: "Ensayo general",
                company: company("GrabandoRD"),
                serviceNames: ["Sonidista"]
            ),
            WorkEvent(
                startDate: day(8),
                endDate: day(8),
                projectName: "Serv. de Streaming, Lumino técnico",
                amount: 18_000,
                paymentStatus: .pending,
                notes: "Un monto cubre ambos servicios.",
                company: company("AudiovisualiaRD"),
                serviceNames: ["Serv. de Streaming", "Lumino técnico"]
            ),
            WorkEvent(
                startDate: day(14),
                endDate: day(15),
                projectName: "Serv. Técnico completo",
                amount: 27_000,
                paymentStatus: .pending,
                notes: "Montaje y show.",
                company: company("Soluciones Audiovisuales"),
                serviceNames: ["Serv. Técnico completo"]
            )
        ]
        samples.forEach { context.insert($0) }
        try? context.save()
    }
}
