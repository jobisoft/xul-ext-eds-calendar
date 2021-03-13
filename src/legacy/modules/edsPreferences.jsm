/* ***** BEGIN LICENSE BLOCK *****
 * EDS Calendar Integration
 * Copyright: 2014-2019 Mateusz Balbus <balbusm@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * The GNU General Public License as published by the Free Software Foundation,
 * version 2 is available at: <http://www.gnu.org/licenses/>
 *
 * ***** END LICENSE BLOCK ***** */
"use strict";

const { getMessenger } = ChromeUtils.import("resource://edscalendar/legacy/modules/utils.jsm");

var EXPORTED_SYMBOLS = ["EdsPreferences"];

const PREF_ROOT = "extensions.edscalendar";

class EdsPreferences {
    constructor() {
        this.messenger = getMessenger();
    }

    getInitialProcressingDelay() {
        let prefs = this.messenger.storage.local.get(PREF_ROOT);
        return prefs["processing.start.delay"];
    }

    getItemProcessingDelay() {
        let prefs = this.messenger.storage.local.get(PREF_ROOT);
        return prefs["processing.item.delay"];
    }

    isDebugEnabled() {
        let prefs = this.messenger.storage.local.get(PREF_ROOT);
        return prefs.debug;
    }
}
