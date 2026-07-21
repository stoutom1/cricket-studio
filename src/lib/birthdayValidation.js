const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getDaysInBirthdayMonth(month) {
  const daysByMonth = {
    1: 31,
    2: 29,
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31,
  };

  return daysByMonth[month] ?? 0;
}

export function validateBirthdayInput(input) {
  const name = String(input?.name ?? "").trim();
  const birthMonth = Number(input?.birthMonth);
  const birthDay = Number(input?.birthDay);
  const notes = String(input?.notes ?? "").trim();

  if (name.length < 2 || name.length > 100) {
    return {
      valid: false,
      error: "Name must contain between 2 and 100 characters.",
    };
  }

  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
    return {
      valid: false,
      error: "Select a valid birth month.",
    };
  }

  const maximumDay = getDaysInBirthdayMonth(birthMonth);

  if (
    !Number.isInteger(birthDay) ||
    birthDay < 1 ||
    birthDay > maximumDay
  ) {
    return {
      valid: false,
      error: `Select a valid day for ${MONTH_NAMES[birthMonth]}.`,
    };
  }

  if (notes.length > 500) {
    return {
      valid: false,
      error: "Notes cannot exceed 500 characters.",
    };
  }

  return {
    valid: true,
    data: {
      name,
      birthMonth,
      birthDay,
      notes: notes || null,
    },
  };
}

export function formatBirthdayMMDD(month, day) {
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}