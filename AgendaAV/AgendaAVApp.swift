import SwiftData
import SwiftUI
import UserNotifications

enum NotificationDelegateStore {
    static let shared = NotificationCenterDelegate()
}

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
        UNUserNotificationCenter.current().delegate = NotificationDelegateStore.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(container)
    }
}
