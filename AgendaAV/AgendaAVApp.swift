import SwiftData
import SwiftUI

@main
struct AgendaAVApp: App {
    private let container: ModelContainer

    init() {
        do {
            let container = try PersistenceController.makeContainer()
            DefaultCatalog.ensure(in: container.mainContext)
            self.container = container
        } catch {
            fatalError("No se pudo iniciar SwiftData: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(container)
    }
}
