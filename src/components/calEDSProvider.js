/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Mateusz Balbus <balbusm@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource:///modules/Services.jsm");
Components.utils.import("resource:///modules/ctypes.jsm");
Components.utils.import("resource:///modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

Components.utils.import("resource://edscalendar/bindings/gio.jsm");
Components.utils.import("resource://edscalendar/bindings/glib.jsm");
Components.utils.import("resource://edscalendar/bindings/libecal.jsm");
Components.utils.import("resource://edscalendar/bindings/libedataserver.jsm");
Components.utils.import("resource://edscalendar/bindings/libical.jsm");

function calEDSProvider() {
    this.initProviderBase();
}

calEDSProvider.prototype = {
    __proto__: cal.ProviderBase.prototype,

    classDescription: "EDS Provider",
    contractID: "@mozilla.org/calendar/calendar;1?type=eds",
    classID:  Components.ID("{4640356f-42a2-4a83-9924-3bda9492ad31}"),
    
    mBatchCalendar : null,
    mBatchClient : null,

    getInterfaces: function getInterfaces (count) {
        var ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calICalendar,
            Components.interfaces.nsIClassInfo, 
            Components.interfaces.calICompositeCalendar
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function getHelperForLanguage(aLanguage) {
        return null;
    },

    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calEDSProvider.prototype, aIID, null, this);
    },

    get type() {
        return "eds";
    },

    get canRefresh() {
        return true;
    },

    get uri() {
        return this.mUri;
    },

    set uri(val) {
        this.mUri = val;
//        if (this.mId && this.mUri) {
//            this.openEDSCalendar();
//        }
        return this.mUri;
    },

    get id() {
        return this.mId;
    },

    set id(val) {
        this.mId = val;
//        if (this.mId && this.mUri) {
//            this.openEDSCalendar();
//        }
        return this.mId;
    },

//    openEDSCalendar: function openEDSCalendar() {
//        let error = glib.GError.ptr();
//        this.ecal = libecal.e_cal_new_system_calendar();
//        let b;
//
//        // TODO If evolution has never been run, opening the system calendar fails.
//        if (libecal.e_cal_open(this.ecal, true, error.address())) {
//            cal.LOG("System ECal opened");
//        } else {
//            cal.ERROR("Error opening EDS Calendar: " + 
//                      error.contents.code + " - " +
//                      error.contents.message.readString());;
//        }
//    },

    refresh: function refresh() {
        this.mObservers.notify("onLoad", [this]);
    },

    getProperty: function getProperty(aName) {
        switch (aName) {
              case "imip.identity.disabled":
                  return true;
              case "organizerId":
              case "organizerCN":
                  return "mailto:eds";
              case "itip.transport":
                  return null;
              case "disabled":
                  // Pretend to be disabled if the calendar could not be opened
                  // to avoid getItems requests on a null calendar
                  return false;
        }
        return this.__proto__.__proto__.getProperty.apply(this, arguments);
    },
    
    createERegistry : function createERegistry() {
      let error = glib.GError.ptr();

      let registry = libedataserver.e_source_registry_new_sync(null, error.address());
      if (!error.isNull())
      {
        ERROR("Couldn't get source registry " + error.contents.code + " - " +
            error.contents.message.readString());
        return null;
      }
      return registry;
    },

    findESource : function findESource(registry, calendar) {
      // look for exising calendar
      let source = libedataserver.e_source_registry_ref_source(registry, calendar.id);
      return source;
    },
    
    getESource : function getESource(registry, calendar) {
      // look for exising calendar
      let source = this.findESource(registry, calendar);
      // do not create new one if calendar exists
      if (source.isNull()) {
        source = this.createESource(calendar, registry);
        LOG("Created new source");
      }
      return source;
    },

    createESource : function createESource(calendar, registry) {
      let error = glib.GError.ptr();

      let source = libecal.e_source_new_with_uid(calendar.id, null, error.address());
      if (!error.isNull())
      {
        ERROR("Couldn't create new source " + error.contents.code + " - " +
            error.contents.message.readString());
        return null;
      }
      let sourceExtension = libecal.e_source_get_extension(source, libedataserver.ESourceCalendar.E_SOURCE_EXTENSION_CALENDAR);
      libecal.e_source_set_display_name(source, calendar.name);
      libecal.e_source_set_parent(source, "local-stub");
      libedataserver.e_source_backend_set_backend_name(ctypes.cast(sourceExtension,libedataserver.ESourceBackend.ptr), "local");
      let sourceCreated  = libedataserver.e_source_registry_commit_source_sync(registry, source, null, error.address());
      if (!sourceCreated || !error.isNull())
      {
        ERROR("Couldn't commit source " + error.contents.code + " - " +
            error.contents.message.readString());
        return null;
      }
      return source;

    },
    
    getECalClient: function getECalClient(calendar, eSourceProvider) {
      // check batch client 
      if (this.mBatchCount > 0 && this.mBatchClient !== null && this.mBatchCalendar === calendar) {
         return this.mBatchClient; 
      }
      
      let error = glib.GError.ptr();
      let registry = this.createERegistry();
      let source = eSourceProvider(registry, calendar);
      let client = libecal.e_cal_client_connect_sync(source, 
          libecal.ECalClientSourceType.E_CAL_CLIENT_SOURCE_TYPE_EVENTS,
          null,
          error.address());
      if (!error.isNull())
      {
        ERROR("Couldn't open source " + error.contents.code + " - " +
            error.contents.message.readString());
        return null;
      }
      // FIXME: Unref old client
      // store new batch client
      if (this.mBatchCount > 0) {
        this.mBatchClient = client;
        this.mBatchCalendar = calendar;
      }

      return client;
    },

    findItem : function findItem(client, item) {
      let error = glib.GError.ptr();
      let icalcomponent = libical.icalcomponent.ptr();

      let found = libecal.e_cal_client_get_object_sync(client, item.id, null, icalcomponent.address(), null, error.address());
      // FIXME remove icalcomponent reference
      return icalcomponent;
    },
    
    getObjModType : function getObjModType(item) {
      let objModType;
      if (item.recurrenceId) {
        objModType = libecal.ECalObjModType.E_CAL_OBJ_MOD_THIS;
      } else {
        objModType = libecal.ECalObjModType.E_CAL_OBJ_MOD_ALL;
      }
      return objModType;
    },

    vcalendar_add_timezones_get_item: function vcalendar_add_timezones(client, comp) {
      let error = glib.GError.ptr();
      let subcomp = libical.icalcomponent_get_first_component(comp, libical.icalcomponent_kind.ICAL_ANY_COMPONENT);
      let itemcomp;
      while (!subcomp.isNull()) {
        switch (libical.icalcomponent_isa(subcomp)) {

        case libical.icalcomponent_kind.ICAL_VTIMEZONE_COMPONENT: {
          let zone = libical.icaltimezone_new();
          if (libical.icaltimezone_set_component(zone, subcomp)) {
            libecal.e_cal_client_add_timezone_sync(client, zone, null, error.address());
            // FIXME: add error check
          }
          break;
        }
        case libical.icalcomponent_kind.ICAL_VEVENT_COMPONENT:
        case libical.icalcomponent_kind.ICAL_VTODO_COMPONENT:
        case libical.icalcomponent_kind.ICAL_VJOURNAL_COMPONENT:
          itemcomp = subcomp;
          break;
        }
        subcomp = libical.icalcomponent_get_next_component(comp, libical.icalcomponent_kind.ICAL_ANY_COMPONENT);
      }

      return itemcomp;
    },
    
    // calICalendar
    adoptItem : function adoptItem(aItem, aListener) {
      let calendar = aItem.calendar;
      let client = this.getECalClient(calendar, this.getESource);
      
      let error = glib.GError.ptr();
      let icalcomponent = this.findItem(client, aItem);
      // item exists in calendar, do not add it
      if (!icalcomponent.isNull()) {
        LOG("Skipping item: " + aItem.title + " - " + aItem.id);
        return;
      }
      // get_object raises error when item is not found
      // clean pointer
      // glib.g_free(error);
      error.value = null;

      let comp = libical.icalcomponent_new_from_string(aItem.icalString);
      let uid = glib.gchar.ptr();

      let itemcomp = this.vcalendar_add_timezones_get_item(client, comp);

      let created = libecal.e_cal_client_create_object_sync(client, itemcomp, uid.address(), null, error.address());
      
      if (created && error.isNull()) {
        // notify obeservers that given item has been synchronized
        this.mObservers.notify("onAddItem", [aItem]);
        nserror = Components.results.NS_OK;
        detail = aItem;
        LOG("Created new EDS item " + aItem.title + " - " + aItem.id);
      } else {
        detail = "EDS: Error adding item: " + 
          error.contents.code + " - " +
          error.contents.message.readString();
        nserror = Components.results.NS_ERROR_FAILURE;
        ERROR(detail);
      }
      this.notifyOperationComplete(aListener,
          nserror,
          Components.interfaces.calIOperationListener.ADD,
          (rc ? aItem.id : null),
          detail);

    },

    // calICalendar
    addItem: function addItem(aItem, aListener) {
        return this.adoptItem(aItem.clone(), aListener);
    },

    // calICalendar
    modifyItem: function modifyItem(aNewItem, aOldItem, aListener) {
      let error = glib.GError.ptr();
      let client = this.getECalClient(calendar, this.findESource);
      let objModType = this.getObjModType(aNewItem);
      let comp = libical.icalcomponent_new_from_string(aNewItem.icalString);
      let subcomp = this.vcalendar_add_timezones_get_item(comp);

      let modified = libecal.e_cal_client_modify_object_sync(client, subcomp, objModType, error.address());

      let detail;
      let nserror;
      if (modified) {
        LOG("Modified item " +  item.title + " " + item.id);
        this.mObservers.notify("onModifyItem", [aNewItem, aOldItem]);
        nserror = Components.results.NS_OK;
        detail = aNewItem;
      } else {
        detail = "EDS: Error modifying item: " + 
          error.contents.code + " - " +
          error.contents.message.readString();
        nserror = Components.results.NS_ERROR_FAILURE;
        ERROR(detail);
      }

      this.notifyOperationComplete(aListener,
          nserror,
          Components.interfaces.calIOperationListener.MODIFY,
          (rc ? aNewItem.id : null),
          detail);
    },

    // calICalendar
    deleteItem: function deleteItem(aItem, aListener) {
      let error = glib.GError.ptr();
      let client = this.getECalClient(calendar, this.findESource);
      let objModType = this.getObjModType(aItem);
      
      let removed = libecal.e_cal_client_remove_object_sync(client, aItem.id, aItem.recurrenceId, objModType, null, error.address());
      let detail;
      let nserror;
      if (!removed) {
        detail = "EDS: Error retrieving items: " + 
          error.contents.code + " - " +
          error.contents.message.readString();
        nserror = Components.results.NS_ERROR_FAILURE;
        ERROR(detail);
      } else {
        LOG("Removed item " +  item.title + " " + item.id);
        this.mObservers.notify("onDeleteItem", [aItem]);
        nserror = Components.results.NS_OK;
        detail = aItem;
      }
      this.notifyOperationComplete(aListener,
          nserror,
          Components.interfaces.calIOperationListener.DELETE,
          (rc ? aItem.id : null),
          detail);
    },

    // calICalendar
    getItem: function getItem(aId, aListener) {
    },

    glist_to_item_array: function glist_to_item_array(glistptr, calendar) {
        let items = [];
        let current = glistptr;
        while (!current.isNull()) {
            let icomp = ctypes.cast(glistptr.contents.data, libical.icalcomponent.ptr);

            // TODO This is not super since we parse the string again. When
            // lightning moves to using js-ctypes for libical, we can just pass
            // the icalcomponent to the item and have it take what it needs
            let icalstring = libical.icalcomponent_as_ical_string(icomp);
            let item = cal.createEvent(icalstring.readString());

            // Set up the calendar for this item
            item.calendar = calendar;
            items.push(item);
            current = current.contents.next;
        }

        return items;
    },

    // calICalendar
    getItems: function getItems(aItemFilter,
                                    aCount,
                                    aRangeStart,
                                    aRangeEnd,
                                    aListener) {

        let objects = glib.GList.ptr();
        let error = glib.GError.ptr();
        let nserror;
        let query = "#t";
        if (aRangeStart && aRangeEnd) {
            query = '(occur-in-time-range? (make-time"{from}") (make-time"{to}"))'
            query = query.replace("{from}", aRangeStart.icalString);
            query = query.replace("{to}", aRangeEnd.icalString);
        }

        cal.LOG("EDS: Query is " + query);

        if (libecal.e_cal_get_object_list(this.ecal, query, objects.address(), error.address())) {
            let items = this.glist_to_item_array(objects, this.superCalendar);
            aListener.onGetResult (this.superCalendar,
                                   Components.results.NS_OK,
                                   Components.interfaces.calIEvent,
                                   null,
                                   items.length,
                                   items);
            nserror = Components.results.NS_OK;
        } else {
            cal.ERROR("EDS: Error retrieving items: " + 
                      error.contents.code + " - " +
                      error.contents.message.readString());
            nserror = Components.results.NS_ERROR_FAILURE;
        }

        libecal.e_cal_free_object_list(objects);

        this.notifyOperationComplete(aListener, nserror, 
                                     Components.interfaces.calIOperationListener.GET,
                                     null, null);
    },
    
    // calICompositeCalendar
    addCalendar : function addCalendar(/*calICalendar*/ aCalendar) {
      let registry = this.createERegistry();
      this.getESource(registry, calendar);
      // FIXME: add calendar items
    },
    
    // calICompositeCalendar
    removeCalendar : function removeCalendar(/*nsIURI*/ aServer) {
      let error = glib.GError.ptr();
      let registry = this.createERegistry();
      // look for exising calendar
      let source = this.findESource(registry, calendar);
      if (source.isNull()) {
        WARN("Calendar " + calendar.name + " " + calendar.id + " doesn't exist. Unable to remove calendar.");
        return;
      }

      let removed = libecal.e_source_remove_sync(source, null, error.address());

      if (!error.isNull()) {
        ERROR("Couldn't remove calendar " + error.contents.code + " - " +
            error.contents.message.readString());
        return;
      }
      LOG("Removed calendar " +  calendar.name + " " + calendar.id);
    },
    
    // calICompositeCalendar
    getCalendar : function getCalendar(/*nsIURI*/ aServer) {
      return null; /*calICalendar*/
    },
    
    // calICompositeCalendar
    getCalendars : function(count, /*calICalendar*/ aCalendars) {
      
    },
    
    // calICompositeCalendar
    setStatusObserver : function (/*calIStatusObserver*/ aStatusObserver, /*nsIDOMChromeWindow*/ aWindow) {
      
    }, 
    
    endBatch : function endBatch() {
      this.__proto__.__proto__.endBatch.apply(this, arguments);
      // FIXME: unref client and calendar
      this.mBatchClient = null;
      this.mBatchCalendar = null;
    }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([calEDSProvider]);
