import Foundation

enum CurrencyFormat {
    /// Código ISO de la moneda del locale del dispositivo (DOP, MXN, CLP, ARS, etc.).
    static var code: String {
        Locale.current.currency?.identifier ?? "USD"
    }

    static func string(from amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.locale = .current
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}
