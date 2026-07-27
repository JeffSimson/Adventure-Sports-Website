// PATCH SUMMARY
// Add:
// let frontGateSales = 0;
//
// While looping line items:
// if (/front\s*gate/i.test(itemName)) {
//    frontGateSales += lineNetAmount;
// }
//
// const kitchenSales = netSales - frontGateSales;
//
// Return:
// frontGateSales: frontGateSales/100,
// kitchenSales: kitchenSales/100
