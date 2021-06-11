// ==UserScript==
// @name        Timesheet++ - unanet.biz
// @namespace   https://github.com/big-beat/
// @match       https://pci-sm.unanet.biz/pci-sm/action/time/edit
// @grant       none
// @version     1.3
// @author      jrib
// @description Display hours remaining in the pay period.
// ==/UserScript==

(function() {
// start copied calendar code
// Date
Date.prototype.copy = function() {
    return new Date(this.valueOf());
}

Date.prototype.advance = function(days = 1) {
    this.setDate(this.getDate() + days);
    return this;
}

Date.prototype.nextDay = function() {
    return this.copy().advance();
}

Date.prototype.daysUntil = function(d) {
    const oneDay = 1000 * 60 * 60 * 24
    return Math.round(Math.abs(this - d) / oneDay);
}

Date.prototype.equals = function(d) {
    return this.toDateString() === d.toDateString();
}

// Sunday = 0, Monday = 1, ... Saturday = 6
Date.prototype.toNextDay = function(day) {
    const newDay = this.copy();
    newDay.setDate(newDay.getDate() + (7 + day - newDay.getDay()) % 7);  // TIL: modulo in javascript keeps negative numbers...
    return newDay;
}

Date.prototype.toPrevDay = function(day) {
    const newDay = this.copy();
    const offset = 7 - day;
    newDay.setDate(newDay.getDate() - (newDay.getDay() + offset) % 7);
    return newDay;
}

Date.prototype.nextFriday = function() {
    return this.toNextDay(5);
}

Date.prototype.nextSunday = function() {
    return this.toNextDay(0);
}

Date.prototype.prevMonday = function() {
    return this.toPrevDay(1);
}


// Models
function Payroll(middleDate) {
    this.middleDate = middleDate,
    this.start = this._start(),
    this.end = this._end()
    this.payday = this._payday()
}

const specialCases = [
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
]

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
}

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
}

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
}

Payroll.prototype.nextPayroll = function() {
    return new Payroll(this.end.nextDay());
}

Payroll.prototype.iterNextPayrolls = function* () {
    payroll = this.nextPayroll();
    while (true) {
        yield payroll;
        payroll = payroll.nextPayroll();
    }
}

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
}

const holidays = new Set([
    new Date(2021, 0, 1),   // New Year's Day
    new Date(2021, 0, 18),  // Martin Luther King, Jr. Day
    new Date(2021, 1, 15),  // Washington's Birthday
    new Date(2021, 4, 31),  // Memorial Day
    new Date(2021, 6, 5),   // Independenc Day
    new Date(2021, 8, 6),   // Labor Day
    new Date(2021, 9, 11),  // Indigenous People Day
    new Date(2021, 10, 11), // Veteran's Day
    new Date(2021, 10, 25), // Thanksgiving Day
    new Date(2021, 11, 27), // Christmas Day
].map(d => d.toDateString()));

function isHoliday(d) {
    if (holidays.has(d.toDateString())) {
        return true;
    }
    return false;
}

function isObservedOffFriday(d) {
    return (isOffFriday(d) && !isHoliday(d)) || dayBeforeHolidayStreak(d);
}

function dayBeforeHolidayStreak(d) {
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

function isOffFriday(d) {
    const anOffFriday = new Date(2021, 1, 19);
    return d.daysUntil(anOffFriday) % 14 === 0;
}

function isToday(d) {
    return d.equals(new Date());
}

function isBeforeToday(d) {
    const today = new Date();
    return d < today && !d.equals(today);  // lol
}
// end copied calendar code

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
