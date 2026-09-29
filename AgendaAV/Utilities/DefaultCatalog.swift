import Foundation
import SwiftData

enum DefaultCatalog {
    static let companies: [(name: String, colorHex: String)] = [
        ("GrabandoRD", "#DC2626"),
        ("Soluciones ingeniosas", "#6B7280"),
        ("Soluciones Audiovisuales", "#2563EB"),
        ("AudiovisualiaRD", "#84CC16"),
        ("Larento", "#7C3AED")
    ]

    static let services = [
        "Sonidista",
        "Lumino técnico",
        "Serv. VJ Pantalla",
        "Serv. Técnico completo",
        "Serv. de Streaming",
        "Parcheo Pantalla",
        "Ensayo"
    ]

    @MainActor
    static func ensure(in context: ModelContext) {
        let existingCompanies = (try? context.fetch(FetchDescriptor<Company>())) ?? []
        for item in companies {
            if let found = existingCompanies.first(where: {
                $0.name.compare(item.name, options: .caseInsensitive) == .orderedSame
            }) {
                found.name = item.name
                found.colorHex = item.colorHex
            } else {
                context.insert(Company(name: item.name, colorHex: item.colorHex))
            }
        }

        let existingServices = (try? context.fetch(FetchDescriptor<CatalogService>())) ?? []
        for name in services {
            if !existingServices.contains(where: {
                $0.name.compare(name, options: .caseInsensitive) == .orderedSame
            }) {
                context.insert(CatalogService(name: name))
            }
        }
        try? context.save()
    }
}
