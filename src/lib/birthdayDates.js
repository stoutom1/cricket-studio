import { DateTime } from "luxon";

export function getLocalBirthdayCheck({
  now = DateTime.utc(),
  timeZone,
  reminderHour,
}) {
  const localNow = now.setZone(timeZone);

  if (!localNow.isValid) {
    throw new Error(`Invalid timezone: ${timeZone}`);
  }

  if (localNow.hour !== reminderHour) {
    return {
      shouldRun: false,
      localNow,
    };
  }

  const today = {
    month: localNow.month,
    day: localNow.day,
    year: localNow.year,
  };

  const tomorrowDate = localNow.plus({ days: 1 });

  const tomorrow = {
    month: tomorrowDate.month,
    day: tomorrowDate.day,
    year: tomorrowDate.year,
  };

  return {
    shouldRun: true,
    localNow,
    today,
    tomorrow,
  };
}

export function birthdayWhereForDate(month, day, year) {
  const isNonLeapYearFebruary28 =
    month === 2 &&
    day === 28 &&
    !DateTime.local(year, 1, 1).isInLeapYear;

  if (isNonLeapYearFebruary28) {
    return {
      OR: [
        {
          birthMonth: 2,
          birthDay: 28,
        },
        {
          birthMonth: 2,
          birthDay: 29,
        },
      ],
    };
  }

  return {
    birthMonth: month,
    birthDay: day,
  };
}