import Foundation
import UserNotifications

enum EventReminderScheduler {
    static func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    static func permissionDenied() async -> Bool {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus == .denied
    }

    static func sync(events: [WorkEvent]) async {
        for event in events {
            reschedule(event: event)
        }
        await deliverDue(events: events)
    }

    static func reschedule(event: WorkEvent) {
        cancel(eventId: event.uuid)
        let title = notificationTitle(for: event)
        for reminder in event.reminders {
            guard let fire = reminder.fireDate(startDate: event.startDate), fire > Date() else { continue }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = reminder.kind.body
            content.sound = .default
            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: fire
            )
            let request = UNNotificationRequest(
                identifier: identifier(eventId: event.uuid, reminderId: reminder.id),
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            )
            UNUserNotificationCenter.current().add(request)
        }
    }

    static func cancel(eventId: UUID) {
        let prefix = "agenda-\(eventId.uuidString)"
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            let ids = requests.map(\.identifier).filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: ids)
        }
        center.getDeliveredNotifications { notes in
            let ids = notes.map(\.request.identifier).filter { $0.hasPrefix(prefix) }
            center.removeDeliveredNotifications(withIdentifiers: ids)
        }
    }

    static func deliverDue(events: [WorkEvent]) async {
        let now = Date()
        let stale: TimeInterval = 14 * 24 * 60 * 60
        for event in events {
            var reminders = event.reminders
            var changed = false
            for index in reminders.indices {
                if reminders[index].notifiedAt != nil { continue }
                guard let fire = reminders[index].fireDate(startDate: event.startDate) else { continue }
                if fire > now { continue }
                if now.timeIntervalSince(fire) > stale {
                    reminders[index].notifiedAt = now
                    changed = true
                    continue
                }
                let content = UNMutableNotificationContent()
                content.title = notificationTitle(for: event)
                content.body = reminders[index].kind.body
                content.sound = .default
                let request = UNNotificationRequest(
                    identifier: identifier(eventId: event.uuid, reminderId: reminders[index].id),
                    content: content,
                    trigger: UNTimeIntervalNotificationTrigger(timeInterval: 0.5, repeats: false)
                )
                UNUserNotificationCenter.current().add(request)
                reminders[index].notifiedAt = now
                changed = true
            }
            if changed {
                event.reminders = reminders
            }
        }
    }

    static func notificationTitle(for event: WorkEvent) -> String {
        let company = event.company?.name ?? "Trabajo"
        let services = event.reportLabel
        let date = event.startDate.formatted(
            .dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_DO"))
        )
        return "\(company) · \(services) · \(date)"
    }

    private static func identifier(eventId: UUID, reminderId: UUID) -> String {
        "agenda-\(eventId.uuidString)-\(reminderId.uuidString)"
    }
}

final class NotificationCenterDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}
