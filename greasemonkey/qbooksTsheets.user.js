// ==UserScript==
// @name        Timesheet++ - tsheets.intuit.com
// @namespace   https://github.com/big-beat/
// @match       https://tsheets.intuit.com/
// @grant       GM_addStyle
// @version     1.0
// @author      jrib
// @description Display hours remaining in the pay period.
// ==/UserScript==
//
// Changelog
// * 1.0: Initial release.

(async function () {
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
        [new Date(2021, 0, 1),    {"name": "New Year's Day"}],
        [new Date(2021, 0, 18),   {"name": "Martin Luther King, Jr. Day"}],
        [new Date(2021, 1, 15),   {"name": "Washington's Birthday"}],
        [new Date(2021, 4, 31),   {"name": "Memorial Day"}],
        [new Date(2021, 6, 5),    {"name": "Independence Day"}],
        [new Date(2021, 8, 6),    {"name": "Labor Day"}],
        [new Date(2021, 9, 11),   {"name": "Indigenous Peoples' Day"}],
        [new Date(2021, 10, 11),  {"name": "Veteran's Day"}],
        [new Date(2021, 10, 25),  {"name": "Thanksgiving Day"}],
        [new Date(2021, 11, 24),  {"name": "Christmas Day"}],
        [new Date(2021, 11, 31),  {"name": "New Year's Day"}],
        [new Date(2022, 0, 17),   {"name": "Martin Luther King Day"}],
        [new Date(2022, 1, 21),   {"name": "President's Day"}],
        [new Date(2022, 4, 30),   {"name": "Memorial Day"}],
        [new Date(2022, 5, 20),   {"name": "Juneteenth"}],
        [new Date(2022, 6, 4),    {"name": "Independence Day"}],
        [new Date(2022, 8, 5),    {"name": "Labor Day"}],
        [new Date(2022, 9, 10),   {"name": "Indigenous Peoples' Day"}],
        [new Date(2022, 10, 11),  {"name": "Veteran's Day"}],
        [new Date(2022, 10, 24),  {"name": "Thanksgiving"}],
        [new Date(2022, 11, 26),  {"name": "Christmas Day"}],
        [new Date(2023, 0, 2),    {"name": "New Year's Day"}],
        [new Date(2023, 0, 16),   {"name": "Martin Luther King Day"}],
        [new Date(2023, 1, 20),   {"name": "President's Day"}],
        [new Date(2023, 4, 29),   {"name": "Memorial Day"}],
        [new Date(2023, 5, 19),   {"name": "Juneteenth"}],
        [new Date(2023, 6, 4),    {"name": "Independence Day"}],
        [new Date(2023, 8, 4),    {"name": "Labor Day"}],
        [new Date(2023, 9, 9),    {"name": "Indigenous Peoples' Day"}],
        [new Date(2023, 10, 10),  {"name": "Veteran's Day"}],
        [new Date(2023, 10, 23),  {"name": "Thanksgiving"}],
        [new Date(2023, 11, 25),  {"name": "Christmas Day"}],
    ].map(([d, v]) => [d.toDateString(), v]))
    },
    "epochgeo": {
        "name": "EpochGeo",
        "specialCases": [],
        "offsetOffFriday": true,
        "holidays": new Map([
            [new Date(2023, 0, 2),    {"name": "New Year's Day"}],
            [new Date(2023, 0, 16),   {"name": "MLK Day"}],
            [new Date(2023, 1, 20),   {"name": "President's Day"}],
            [new Date(2023, 4, 29),   {"name": "Memorial Day"}],
            [new Date(2023, 5, 19),   {"name": "Juneteenth"}],
            [new Date(2023, 6, 4),    {"name": "Independence Day"}],
            [new Date(2023, 8, 4),    {"name": "Labor Day"}],
            [new Date(2023, 9, 9),    {"name": "Indigenous Peoples' Day"}],
            [new Date(2023, 10, 10),  {"name": "Veteran's Day"}],
            [new Date(2023, 10, 23),  {"name": "Thanksgiving Day"}],
            [new Date(2023, 10, 24),  {"name": "EpochGeo Holiday"}],
            [new Date(2023, 11, 22),  {"name": "EpochGeo Holiday"}],
            [new Date(2023, 11, 25),  {"name": "Christmas Day"}],
            [new Date(2023, 11, 29),  {"name": "EpochGeo Holiday (NYE)"}],
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
    return "epochgeo";
}

// wait for selector to appear in the dom
// if filter is given, then only resolve if filter(matchedElement) is truthy
function waitFor(selector, filter) {
    return new Promise(resolve => {
        const observer = new MutationObserver(mutations => {
            const elt = document.querySelector(selector);
            if (elt) {
                if (filter && !filter(elt)) {
                    return;
                }
                resolve(elt);
                observer.disconnect();
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

async function Greasemonkey_main() {
    //  We rely on two globals currently:
    //      - vars: to determine the user's Id
    //      - xajax: to make requests for the user's hours
    if (typeof(vars) === 'undefined') {
        throw 'vars is an expected global but it is not defined! Open an issue at https://github.com/big-beat/bigbeat.io/issues/new/choose .';
    }
    if (typeof(xajax) === 'undefined') {
        throw 'xajax is an expected global but it is not defined! Open an issue at https://github.com/big-beat/bigbeat.io/issues/new/choose .';
    }

    function formatDate(d) {
        const year = d.getFullYear();
        const month = (1 + d.getMonth()).toString().padStart(2, "0");
        const day = d.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // Create the element to display the hours remaining.
    const css = `
        #bigbeat-hours-remaining p {
            margin: 0;
        }
    `;
    GM_addStyle(css);
    const hoursEl = document.createElement("div");
    const clock = document.querySelector("#clock_wrapper");
    hoursEl.id = "bigbeat-hours-remaining";
    document.querySelector("#box_top").insertBefore(hoursEl, clock);

    // Gather data to request informatino for current pay period.
    const payPeriod = new Payroll(new Date());
    const start = formatDate(payPeriod.start);
    const end = formatDate(payPeriod.end);
    const userId = vars.user_id;
    const windowName = "timesheet_list_v2";

    function renderHoursDisplay(hoursLeft, hoursWorked, hoursNeeded, holidayHours) {
        const holidayNote = holidayHours ? ` (${holidayHours} holiday hours)` : "";
        return `<p>${hoursWorked} hours entered of ${hoursNeeded} hours needed${holidayNote}.</p>
                <p><strong>Hours remaining:</strong> ${hoursLeft}.</p>`;
    }

    // Make a network request to fetch the hours saved for the current pay period and update hours remaining.
    function updateHours() {
        try {
            xajax.json_post(
                windowName,
                "get_data_for_date_range",
                {
                    user_ids: [userId],
                    start,
                    end,
                    days_to_load: start,
                    per_page: 50,
                    sort: { column: "Time in - out", ascending: false },
                },
                {
                    error: function (e) {
                        console.error(e);
                        hoursEl.innerHTML = "[Something went wrong :(]";
                    },
                    success: function (result) {
                        const secondsWorked = result.days.reduce(
                            (sum, day) => (sum += day.total),
                            0
                        );
                        const hoursWorked = secondsWorked / 60 / 60;

                        const stats = payPeriod.stats();
                        const hoursNeeded = stats.workHours + stats.holidayHours;
                        const hoursLeft = hoursNeeded - hoursWorked;
                        console.log(`Updating hours to ${hoursLeft}.`);
                        hoursEl.innerHTML = renderHoursDisplay(hoursLeft, hoursWorked, hoursNeeded, stats.holidayHours);
                    },
                }
            );
        } catch (e) {
            console.error(e);
            hoursEl.innerHTML = "[Something went wrong :(]";
        }
    }

    // Update hours as soon as we load.
    updateHours();

    // Trigger an update when both:
    //    1. changes are saved (detect snackbar) AND
    //    2. the total hours for this week changed
    let last = null;
    async function waitForSnackbar() {
        const snackTextOnSave = "Changes saved successfully";
        const snackbarRole = '[role="alert"]';

        await waitFor(snackbarRole, snack => snackTextOnSave === snack.textContent);
        const now = document.getElementById("weekly_timecard_weekly_grand_total").value;
        if (last !== now) {
            last = now;
            updateHours();
        }
    }

    // Wait for the save button and subscribe to its click events.
    const saveButtonSelector = "#weekly_timecard_submit_button";
    const saveButton = await waitFor(saveButtonSelector);
    saveButton.addEventListener("click", waitForSnackbar);
}

window.addEventListener("load", Greasemonkey_main, false);
})();
