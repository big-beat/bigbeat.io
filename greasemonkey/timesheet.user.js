// ==UserScript==
// @name        Timesheet++ - unanet.biz
// @namespace   https://github.com/big-beat/
// @match       https://pci-sm.unanet.biz/pci-sm/action/time/edit
// @grant       none
// @version     1.10
// @author      jrib
// @description Display hours remaining in the pay period.
// ==/UserScript==
//
// Changelog
// * 1.0: Initial release.
// * 1.1: Use workHours + holidayHours when calculating remaining hours.
// * 1.2: No change.  Testing greasemonkey update behavior.
// * 1.3: Recalculate hours on input blur.
// * 1.4: Update 2021 Christmas holiday to 2021-12-24.
// * 1.5: (greasemonkey branch only): Add note that script has moved to master.
// * 1.6: Remove link to master branch.
// * 1.7: Calendar library API improvements.  No functional changes.
// * 1.8: Update 2023 holidays
// * 1.9: Support company profiles
// * 1.10: Update 2024 holidays

(function() {
// start copied calendar code
// start shared calendar code
// this code is copied from index.html to the greasemonkey extension by `scripts/sync-calendar-code`
// Date
Date.prototype.copy = function() {
    return new Date(this.valueOf());
};

Date.prototype.advance = function(days = 1) {
    this.setDate(this.getDate() + days);
    return this;
};

Date.prototype.nextDay = function() {
    return this.copy().advance();
};

Date.prototype.daysUntil = function(d) {
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.round(Math.abs(this - d) / oneDay);
};

Date.prototype.equals = function(d) {
    return this.toDateString() === d.toDateString();
};

// Sunday = 0, Monday = 1, ... Saturday = 6
// Includes the current day.
Date.prototype.untilDay = function(day) {
    const newDay = this.copy();
    newDay.setDate(newDay.getDate() + (7 + day - newDay.getDay()) % 7);  // TIL: modulo in javascript keeps negative numbers...
    return newDay;
};

// Includes the current day.
Date.prototype.untilPrevDay = function(day) {
    const newDay = this.copy();
    const offset = 7 - day;
    newDay.setDate(newDay.getDate() - (newDay.getDay() + offset) % 7);
    return newDay;
};

Date.prototype.untilSunday = function() {
    return this.untilDay(0);
};

Date.prototype.prevMonday = function() {
    return this.untilPrevDay(1);
};

// "next" *excludes* the current day
Date.prototype.nextFriday = function() {
    return this.nextDay().untilDay(5);
};


// Models
function Payroll(middleDate) {
    this.middleDate = middleDate;
    this.start = this._start();
    this.end = this._end();
    this.payday = this._payday();
}

let calendarSettings = {
    "bigbear": {
        "name": "BigBear",
        "specialCases": [
            {
                "start": new Date(2021, 2, 20),
                "end": new Date(2021, 2, 31),
                "payday": new Date(2021, 2, 31),
            },
            {
                "start": new Date(2021, 3, 1),
                "end": new Date(2021, 3, 7),
                "payday": new Date(2021, 3, 12),
            },
            {
                "start": new Date(2021, 3, 8),
                "end": new Date(2021, 3, 15),
                "payday": new Date(2021, 3, 22),
            },
        ],
        "offsetOffFriday": false,
        "holidays": new Map([
            [new Date(2023, 0, 2),    {"name": "New Year's Day"}],
            [new Date(2023, 0, 16),   {"name": "Martin Luther King Day"}],
            [new Date(2023, 1, 20),   {"name": "President's Day"}],
            [new Date(2023, 4, 29),   {"name": "Memorial Day"}],
            [new Date(2023, 5, 19),   {"name": "Juneteenth"}],
            [new Date(2023, 6, 4),    {"name": "Independence Day"}],
            [new Date(2023, 8, 4),    {"name": "Labor Day"}],
            [new Date(2023, 9, 9),    {"name": "Indigenous Peoples' Day"}],
            [new Date(2023, 10, 10),  {"name": "Veterans Day"}],
            [new Date(2023, 10, 23),  {"name": "Thanksgiving"}],
            [new Date(2023, 11, 25),  {"name": "Christmas Day"}],
            [new Date(2024, 0, 1),    {"name": "New Year's Day"}],
            [new Date(2024, 0, 15),   {"name": "Martin Luther King Day"}],
            [new Date(2024, 1, 19),   {"name": "President's Day"}],
            [new Date(2024, 4, 27),   {"name": "Memorial Day"}],
            [new Date(2024, 5, 19),   {"name": "Juneteenth"}],
            [new Date(2024, 6, 4),    {"name": "Independence Day"}],
            [new Date(2024, 8, 2),    {"name": "Labor Day"}],
            [new Date(2024, 9, 14),   {"name": "Indigenous Peoples' Day"}],
            [new Date(2024, 10, 11),  {"name": "Veterans Day"}],
            [new Date(2024, 10, 28),  {"name": "Thanksgiving"}],
            [new Date(2024, 11, 25),  {"name": "Christmas Day"}],
            [new Date(2025, 0, 1),    {"name": "New Year's Day"}],
            [new Date(2025, 0, 20),   {"name": "Martin Luther King Jr. Day"}],
            [new Date(2025, 1, 17),   {"name": "President's Day"}],
            [new Date(2025, 4, 26),   {"name": "Memorial Day"}],
            [new Date(2025, 5, 19),   {"name": "Juneteenth"}],
            [new Date(2025, 6, 4),    {"name": "Independence Day"}],
            [new Date(2025, 8, 1),    {"name": "Labor Day"}],
            [new Date(2025, 9, 13),   {"name": "Indigenous Peoples' Day"}],
            [new Date(2025, 10, 11),  {"name": "Veterans Day"}],
            [new Date(2025, 10, 27),  {"name": "Thanksgiving"}],
            [new Date(2025, 11, 25),  {"name": "Christmas Day"}]
        ].map(([d, v]) => [d.toDateString(), v]))
    },
    "epochgeo": {
        "name": "EpochGeo",
        "specialCases": [],
        "offsetOffFriday": false,
        "holidays": new Map([
            [new Date(2023, 0, 2),    { "name": "New Year's Day"}],
            [new Date(2023, 0, 16),   { "name": "MLK Day"}],
            [new Date(2023, 1, 20),   { "name": "President's Day"}],
            [new Date(2023, 4, 29),   { "name": "Memorial Day"}],
            [new Date(2023, 5, 19),   { "name": "Juneteenth"}],
            [new Date(2023, 6, 4),    { "name": "Independence Day"}],
            [new Date(2023, 8, 4),    { "name": "Labor Day"}],
            [new Date(2023, 9, 9),    { "name": "Indigenous Peoples' Day"}],
            [new Date(2023, 10, 10),  { "name": "Veterans Day"}],
            [new Date(2023, 10, 23),  { "name": "Thanksgiving Day"}],
            [new Date(2023, 10, 24),  { "name": "EpochGeo Holiday"}],
            [new Date(2023, 11, 22),  { "name": "EpochGeo Holiday"}],
            [new Date(2023, 11, 25),  { "name": "Christmas Day"}],
            [new Date(2023, 11, 29),  { "name": "EpochGeo Holiday (NYE)"}],
            [new Date(2024, 0, 1),    { "name": "New Year's Day"}],
            [new Date(2024, 0, 15),   { "name": "Martin Luther King, Jr. Day"}],
            [new Date(2024, 1, 19),   { "name": "Presidents' Day"}],
            [new Date(2024, 4, 27),   { "name": "Memorial Day"}],
            [new Date(2024, 5, 19),   { "name": "Juneteenth"}],
            [new Date(2024, 6, 4),    { "name": "Independence Day"}],
            [new Date(2024, 8, 2),    { "name": "Labor Day"}],
            [new Date(2024, 9, 14),   { "name": "Columbus Day (Indigenous Peoples' Day)"}],
            [new Date(2024, 10, 11),  { "name": "Veterans Day"}],
            [new Date(2024, 10, 28),  { "name": "Thanksgiving"}],
            [new Date(2024, 10, 29),  { "name": "EpochGeo Holiday"}],
            [new Date(2024, 11, 24),  { "name": "EpochGeo Holiday"}],
            [new Date(2024, 11, 25),  { "name": "Christmas Day"}],
            [new Date(2024, 11, 31),  { "name": "EpochGeo Holiday (NYE)"}],
            [new Date(2025, 0, 1),    { "name": "New Year's Day"}],
            [new Date(2025, 0, 20),   { "name": "Martin Luther King, Jr. Day"}],
            [new Date(2025, 1, 17),   { "name": "Presidents' Day"}],
            [new Date(2025, 4, 26),   { "name": "Memorial Day"}],
            [new Date(2025, 5, 19),   { "name": "Juneteenth"}],
            [new Date(2025, 6, 4),    { "name": "Independence Day"}],
            [new Date(2025, 8, 1),    { "name": "Labor Day"}],
            [new Date(2025, 9, 13),   { "name": "Columbus Day (Indigenous Peoples' Day)"}],
            [new Date(2025, 10, 11),  { "name": "Veterans Day"}],
            [new Date(2025, 10, 27),  { "name": "Thanksgiving"}],
            [new Date(2025, 10, 28),  { "name": "EpochGeo Holiday"}],
            [new Date(2025, 11, 24),  { "name": "EpochGeo Holiday"}],
            [new Date(2025, 11, 25),  { "name": "Christmas Day"}],
            [new Date(2025, 11, 31),  { "name": "EpochGeo Holiday (NYE)"}],
        ].map(([d, v]) => [d.toDateString(), v]))
    }
}

const profile = determineProfile();

const specialCases = calendarSettings[profile].specialCases;

Payroll.prototype._start = function() {
    const d = this.middleDate;
    for (let specialCase of specialCases) {
        if (specialCase.start <= d && d <= specialCase.end) {
                return specialCase.start;
        }
    }
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const start = day < 16 ? 1 : 16;
    return new Date(year, month, start);
};

Payroll.prototype._end = function() {
    const d = this.middleDate;
    for (let specialCase of specialCases) {
        if (specialCase.start <= d && d <= specialCase.end) {
                return specialCase.end;
        }
    }
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    const end = day < 16 ?
            new Date(year, month, 15) :
            new Date(year, month+1, 0);
    return end;
};

Payroll.prototype._payday = function() {
    const d = this.middleDate;
    for (let specialCase of specialCases) {
        if (specialCase.start <= d && d <= specialCase.end) {
                return specialCase.payday;
        }
    }

    const startYear = this.start.getFullYear();
    const startMonth = this.start.getMonth();
    const startDay = this.start.getDate();

    if (startDay === 1) {
        return new Date(startYear, startMonth, 22);
    } else if (startDay == 16) {
        return new Date(startYear, startMonth+1, 7);
    } else {
        throw `startDay (${startDay}) is not 1 or 16`;
    }
};

Payroll.prototype.nextPayroll = function() {
    return new Payroll(this.end.nextDay());
};

Payroll.prototype.iterNextPayrolls = function* () {
    let payroll = this.nextPayroll();
    while (true) {
        yield payroll;
        payroll = payroll.nextPayroll();
    }
};

Payroll.prototype.stats = function() {
    const stats = {
        holidayHours: 0,
        workHours: 0,
        workDays: 0,
        nineEightyHours: 0
    };
    let i = this.start.copy();
    while (i <= this.end) {
        if (i.getDay() > 0 && i.getDay() < 6) {
            if (isHoliday(i)) {
                stats.holidayHours += 8;
                stats.nineEightyHours += 8;
            } else {
                stats.workHours += 8;
                if (!isObservedOffFriday(i)) {
                    if (isFriday(i)) {
                        stats.nineEightyHours += 8;
                    }
                    else {
                        stats.nineEightyHours += 9;
                    }

                    stats.workDays += 1;
                }
            }
        }
        i.advance();
    }
    return stats;
};

const holidays = calendarSettings[profile].holidays;

function isHoliday(d) {
    return holidays.has(d.toDateString());
}

function holidayName(d) {
    return holidays.get(d.toDateString())?.name;
}

function isObservedOffFriday(d) {
    return (isOffFriday(d) && !isHoliday(d)) || dayBeforeHolidayStreak(d);
}

function dayBeforeHolidayStreak(d) {
    // This function probably does the wrong thing if we ever have a super long holiday streak ;)
    const friday = d.nextFriday();

    // next friday is off friday
    if (!isOffFriday(friday)) {
        return false;
    }

    // all the days leading up to it are holidays
    let i = d.nextDay();
    while (i <= friday) {
        if (!isHoliday(i)) {
            return false;
        }
        i.advance();
    }
    return true;
}

function isFriday(d) {
    return d.getDay() === 5;
}

const offsetOffFriday = calendarSettings[profile].offsetOffFriday;

function isOffFriday(d) {
    const anOffFriday = new Date(2021, 1, 19);
    const offset = offsetOffFriday ? 7 : 0;
    return (d.daysUntil(anOffFriday) + offset) % 14 === 0;
}

function isToday(d) {
    return d.equals(new Date());
}

function isBeforeToday(d) {
    const today = new Date();
    return d < today && !d.equals(today);  // lol
}
// end shared calendar code
// end copied calendar code

function determineProfile() {
    return "bigbear";
}

window.addEventListener ("load", Greasemonkey_main, false);

function Greasemonkey_main () {
    // our global to avoid conflicts
    var bigBeat = window.bigBeat = {};

    // update hours remaining being displayed
    bigBeat.updateHoursRemaining = function() {
        var payPeriod = new Payroll(dates[0]).stats();

        var hoursNeeded = payPeriod.workHours + payPeriod.holidayHours;
        var hoursEntered = tconfig.getGridTotalF();
        var hoursRemaining = hoursNeeded - hoursEntered ;

        var hoursEl = document.querySelector("#bigbeat-hours-remaining");
        // TODO: link to bigbeat but fix styling
        //hoursEl.innerHTML = "[hours remaining: <a target='_blank' href='https://bigbeat.io'>" + hoursRemaining + "</a>]";
        hoursEl.innerHTML = "[hours remaining: " + hoursRemaining + "]";
    }

    /*
     * We rely on two globals currently:
     *     - tconfig: to access the function to compute entered total
     *     - dates: to know what pay-period we are in
     */
    if (!tconfig) {
        throw 'tconfig is an expected global but it is not defined! Open an issue at https://github.com/big-beat/bigbeat.io/issues/new/choose .';
    } else if (!dates[0]) {
        throw 'dates[0] is an expected global but it is not defined! Open an issue at https://github.com/big-beat/bigbeat.io/issues/new/choose .';
    } else {
        // create the element to display the hours remaining
        var hoursEl = document.createElement("span");
        hoursEl.id = 'bigbeat-hours-remaining';
        document.querySelector("#page-title-cont #page-title").appendChild(hoursEl);
        bigBeat.updateHoursRemaining();

        // update hours remaining on input blur
        document.querySelectorAll("input.hours").forEach(function(e) {
            e.setAttribute('onblur',  e.getAttribute('onblur') + '; bigBeat.updateHoursRemaining();');
        });
    }
}
})();
