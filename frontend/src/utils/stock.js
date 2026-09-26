export const LOW_STOCK_THRESHOLD = 3;

export const getStockStatus = (quantity) => {
  const qty = Number(quantity || 0);

  if (qty === 0) {
    return {
      text: "Tugagan",
      className: "danger",
    };
  }

  if (qty <= LOW_STOCK_THRESHOLD) {
    return {
      text: "Kam qolgan",
      className: "warning",
    };
  }

  return {
    text: "Mavjud",
    className: "success",
  };
};

export const isLowStock = (quantity) => {
  const qty = Number(quantity || 0);
  return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
};
