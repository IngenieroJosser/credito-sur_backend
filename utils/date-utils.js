"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDateRange = calculateDateRange;
exports.formatCurrency = formatCurrency;
function calculateDateRange(period, customStart, customEnd) {
    const now = new Date();
    let startDate;
    let endDate = new Date();
    switch (period) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate = new Date(now.setHours(23, 59, 59, 999));
            break;
        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay());
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setDate(now.getDate() + (6 - now.getDay()));
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
            break;
        case 'custom':
            startDate = customStart ? new Date(customStart) : new Date(now.setHours(0, 0, 0, 0));
            endDate = customEnd ? new Date(customEnd) : new Date();
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    if (isNaN(startDate.getTime()))
        startDate = new Date();
    if (isNaN(endDate.getTime()))
        endDate = new Date();
    const timeDiff = endDate.getTime() - startDate.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    return { startDate, endDate, days };
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-PY', {
        style: 'currency',
        currency: 'PYG',
        minimumFractionDigits: 0,
    }).format(amount);
}
//# sourceMappingURL=date-utils.js.map