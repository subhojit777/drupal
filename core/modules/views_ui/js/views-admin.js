/**
 * @file
 * Some basic behaviors and utility functions for Views UI.
 */

(function ($, Drupal, drupalSettings) {

  "use strict";

  /**
   * @namespace
   */
  Drupal.viewsUi = {};

  /**
   * Improve the user experience of the views edit interface.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiEditView = {
    attach: function () {
      // Only show the SQL rewrite warning when the user has chosen the
      // corresponding checkbox.
      $('#edit-query-options-disable-sql-rewrite').on('click', function () {
        $('.sql-rewrite-warning').toggleClass('js-hide');
      });
    }
  };

  /**
   * In the add view wizard, use the view name to prepopulate form fields such
   * as page title and menu link.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiAddView = {
    attach: function (context) {
      var $context = $(context);
      // Set up regular expressions to allow only numbers, letters, and dashes.
      var exclude = new RegExp('[^a-z0-9\\-]+', 'g');
      var replace = '-';
      var suffix;

      // The page title, block title, and menu link fields can all be
      // prepopulated with the view name - no regular expression needed.
      var $fields = $context.find('[id^="edit-page-title"], [id^="edit-block-title"], [id^="edit-page-link-properties-title"]');
      if ($fields.length) {
        if (!this.fieldsFiller) {
          this.fieldsFiller = new Drupal.viewsUi.FormFieldFiller($fields);
        }
        else {
          // After an AJAX response, this.fieldsFiller will still have event
          // handlers bound to the old version of the form fields (which don't
          // exist anymore). The event handlers need to be unbound and then
          // rebound to the new markup. Note that jQuery.live is difficult to
          // make work in this case because the IDs of the form fields change
          // on every AJAX response.
          this.fieldsFiller.rebind($fields);
        }
      }

      // Prepopulate the path field with a URLified version of the view name.
      var $pathField = $context.find('[id^="edit-page-path"]');
      if ($pathField.length) {
        if (!this.pathFiller) {
          this.pathFiller = new Drupal.viewsUi.FormFieldFiller($pathField, exclude, replace);
        }
        else {
          this.pathFiller.rebind($pathField);
        }
      }

      // Populate the RSS feed field with a URLified version of the view name,
      // and an .xml suffix (to make it unique).
      var $feedField = $context.find('[id^="edit-page-feed-properties-path"]');
      if ($feedField.length) {
        if (!this.feedFiller) {
          suffix = '.xml';
          this.feedFiller = new Drupal.viewsUi.FormFieldFiller($feedField, exclude, replace, suffix);
        }
        else {
          this.feedFiller.rebind($feedField);
        }
      }
    }
  };

  /**
   * Constructor for the {@link Drupal.viewsUi.FormFieldFiller} object.
   *
   * Prepopulates a form field based on the view name.
   *
   * @constructor
   *
   * @param {jQuery} $target
   *   A jQuery object representing the form field or fields to prepopulate.
   * @param {bool} [exclude=false]
   *   A regular expression representing characters to exclude from
   *   the target field.
   * @param {string} [replace='']
   *   A string to use as the replacement value for disallowed characters.
   * @param {string} [suffix='']
   *   A suffix to append at the end of the target field content.
   */
  Drupal.viewsUi.FormFieldFiller = function ($target, exclude, replace, suffix) {

    /**
     *
     * @type {jQuery}
     */
    this.source = $('#edit-label');

    /**
     *
     * @type {jQuery}
     */
    this.target = $target;

    /**
     *
     * @type {bool}
     */
    this.exclude = exclude || false;

    /**
     *
     * @type {string}
     */
    this.replace = replace || '';

    /**
     *
     * @type {string}
     */
    this.suffix = suffix || '';

    // Create bound versions of this instance's object methods to use as event
    // handlers. This will let us easily unbind those specific handlers later
    // on. NOTE: jQuery.proxy will not work for this because it assumes we want
    // only one bound version of an object method, whereas we need one version
    // per object instance.
    var self = this;

    /**
     *
     * @return {*}
     */
    this.populate = function () { return self._populate.call(self); };

    /**
     *
     * @return {*}
     */
    this.unbind = function () { return self._unbind.call(self); };

    this.bind();
    // Object constructor; no return value.
  };

  $.extend(Drupal.viewsUi.FormFieldFiller.prototype, /** @lends Drupal.viewsUi.FormFieldFiller# */{

    /**
     * Bind the form-filling behavior.
     */
    bind: function () {
      this.unbind();
      // Populate the form field when the source changes.
      this.source.on('keyup.viewsUi change.viewsUi', this.populate);
      // Quit populating the field as soon as it gets focus.
      this.target.on('focus.viewsUi', this.unbind);
    },

    /**
     * Get the source form field value as altered by the passed-in parameters.
     *
     * @return {string}
     */
    getTransliterated: function () {
      var from = this.source.val();
      if (this.exclude) {
        from = from.toLowerCase().replace(this.exclude, this.replace);
      }
      return from;
    },

    /**
     * Populate the target form field with the altered source field value.
     */
    _populate: function () {
      var transliterated = this.getTransliterated();
      var suffix = this.suffix;
      this.target.each(function (i) {
        // Ensure that the maxlength is not exceeded by prepopulating the field.
        var maxlength = $(this).attr('maxlength') - suffix.length;
        $(this).val(transliterated.substr(0, maxlength) + suffix);
      });
    },

    /**
     * Stop prepopulating the form fields.
     */
    _unbind: function () {
      this.source.off('keyup.viewsUi change.viewsUi', this.populate);
      this.target.off('focus.viewsUi', this.unbind);
    },

    /**
     * Bind event handlers to new form fields, after they're replaced via Ajax.
     *
     * @param {jQuery} $fields
     */
    rebind: function ($fields) {
      this.target = $fields;
      this.bind();
    }
  });

  /**
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.addItemForm = {
    attach: function (context) {
      var $context = $(context);
      var $form = $context;
      // The add handler form may have an id of views-ui-add-handler-form--n.
      if (!$context.is('form[id^="views-ui-add-handler-form"]')) {
        $form = $context.find('form[id^="views-ui-add-handler-form"]');
      }
      if ($form.once('views-ui-add-handler-form').length) {
        // If we we have an unprocessed views-ui-add-handler-form, let's
        // instantiate.
        new Drupal.viewsUi.AddItemForm($form);
      }
    }
  };

  /**
   *
   * @constructor
   *
   * @param {jQuery} $form
   */
  Drupal.viewsUi.AddItemForm = function ($form) {

    /**
     *
     * @type {jQuery}
     */
    this.$form = $form;
    this.$form.find('.views-filterable-options :checkbox').on('click', $.proxy(this.handleCheck, this));

    /**
     * Find the wrapper of the displayed text.
     */
    this.$selected_div = this.$form.find('.views-selected-options').parent();
    this.$selected_div.hide();

    /**
     *
     * @type {Array}
     */
    this.checkedItems = [];
  };

  /**
   *
   * @param {jQuery.Event} event
   */
  Drupal.viewsUi.AddItemForm.prototype.handleCheck = function (event) {
    var $target = $(event.target);
    var label = $.trim($target.next().text());
    // Add/remove the checked item to the list.
    if ($target.is(':checked')) {
      this.$selected_div.show().css('display', 'block');
      this.checkedItems.push(label);
    }
    else {
      var position = $.inArray(label, this.checkedItems);
      // Delete the item from the list and make sure that the list doesn't have
      // undefined items left.
      for (var i = 0; i < this.checkedItems.length; i++) {
        if (i === position) {
          this.checkedItems.splice(i, 1);
          i--;
          break;
        }
      }
      // Hide it again if none item is selected.
      if (this.checkedItems.length === 0) {
        this.$selected_div.hide();
      }
    }
    this.refreshCheckedItems();
  };

  /**
   * Refresh the display of the checked items.
   */
  Drupal.viewsUi.AddItemForm.prototype.refreshCheckedItems = function () {
    // Perhaps we should precache the text div, too.
    this.$selected_div.find('.views-selected-options')
      .html(this.checkedItems.join(', '))
      .trigger('dialogContentResize');
  };

  /**
   * The input field items that add displays must be rendered as `<input>`
   * elements. The following behavior detaches the `<input>` elements from the
   * DOM, wraps them in an unordered list, then appends them to the list of
   * tabs.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiRenderAddViewButton = {
    attach: function (context) {
      // Build the add display menu and pull the display input buttons into it.
      var $menu = $(context).find('#views-display-menu-tabs').once('views-ui-render-add-view-button');
      if (!$menu.length) {
        return;
      }

      var $addDisplayDropdown = $('<li class="add"><a href="#"><span class="icon add"></span>' + Drupal.t('Add') + '</a><ul class="action-list" style="display:none;"></ul></li>');
      var $displayButtons = $menu.nextAll('input.add-display').detach();
      $displayButtons.appendTo($addDisplayDropdown.find('.action-list')).wrap('<li>')
        .parent().eq(0).addClass('first').end().eq(-1).addClass('last');
      // Remove the 'Add ' prefix from the button labels since they're being
      // placed in an 'Add' dropdown. @todo This assumes English, but so does
      // $addDisplayDropdown above. Add support for translation.
      $displayButtons.each(function () {
        var label = $(this).val();
        if (label.substr(0, 4) === 'Add ') {
          $(this).val(label.substr(4));
        }
      });
      $addDisplayDropdown.appendTo($menu);

      // Add the click handler for the add display button.
      $menu.find('li.add > a').on('click', function (event) {
        event.preventDefault();
        var $trigger = $(this);
        Drupal.behaviors.viewsUiRenderAddViewButton.toggleMenu($trigger);
      });
      // Add a mouseleave handler to close the dropdown when the user mouses
      // away from the item. We use mouseleave instead of mouseout because
      // the user is going to trigger mouseout when she moves from the trigger
      // link to the sub menu items.
      // We use the live binder because the open class on this item will be
      // toggled on and off and we want the handler to take effect in the cases
      // that the class is present, but not when it isn't.
      $('li.add', $menu).on('mouseleave', function (event) {
        var $this = $(this);
        var $trigger = $this.children('a[href="#"]');
        if ($this.children('.action-list').is(':visible')) {
          Drupal.behaviors.viewsUiRenderAddViewButton.toggleMenu($trigger);
        }
      });
    }
  };

  /**
   * @param {jQuery} $trigger
   *
   *
   * @note [@jessebeach] I feel like the following should be a more generic
   *   function and not written specifically for this UI, but I'm not sure
   *   where to put it.
   */
  Drupal.behaviors.viewsUiRenderAddViewButton.toggleMenu = function ($trigger) {
    $trigger.parent().toggleClass('open');
    $trigger.next().slideToggle('fast');
  };

  /**
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiSearchOptions = {
    attach: function (context) {
      var $context = $(context);
      var $form = $context;
      // The add handler form may have an id of views-ui-add-handler-form--n.
      if (!$context.is('form[id^="views-ui-add-handler-form"]')) {
        $form = $context.find('form[id^="views-ui-add-handler-form"]');
      }
      // Make sure we don't add more than one event handler to the same form.
      if ($form.once('views-ui-filter-options').length) {
        new Drupal.viewsUi.OptionsSearch($form);
      }
    }
  };

  /**
   * Constructor for the viewsUi.OptionsSearch object.
   *
   * The OptionsSearch object filters the available options on a form according
   * to the user's search term. Typing in "taxonomy" will show only those
   * options containing "taxonomy" in their label.
   *
   * @constructor
   *
   * @param {jQuery} $form
   */
  Drupal.viewsUi.OptionsSearch = function ($form) {

    /**
     *
     * @type {jQuery}
     */
    this.$form = $form;

    /**
     * Add a keyup handler to the search box.
     */
    this.$searchBox = this.$form.find('#edit-override-controls-options-search');
    this.$searchBox.on('keyup', $.proxy(this.handleKeyup, this));

    /**
     * Get a list of option labels and their corresponding divs and maintain it
     * in memory, so we have as little overhead as possible at keyup time.
     */
    this.options = this.getOptions(this.$form.find('.filterable-option'));

    // Restripe on initial loading.
    this.handleKeyup();
    // Trap the ENTER key in the search box so that it doesn't submit the form.
    this.$searchBox.on('keypress', function (event) {
      if (event.which === 13) {
        event.preventDefault();
      }
    });
  };

  $.extend(Drupal.viewsUi.OptionsSearch.prototype, /** @lends Drupal.viewsUi.OptionsSearch# */{

    /**
     * Assemble a list of all the filterable options on the form.
     *
     * @param {jQuery} $allOptions
     *   A jQuery object representing the rows of filterable options to be
     *   shown and hidden depending on the user's search terms.
     *
     * @return {Array}
     */
    getOptions: function ($allOptions) {
      var $label;
      var $description;
      var $option;
      var options = [];
      var length = $allOptions.length;
      for (var i = 0; i < length; i++) {
        $option = $($allOptions[i]);
        $label = $option.find('label');
        $description = $option.find('div.description');
        options[i] = {
          // Search on the lowercase version of the label text + description.
          'searchText': $label.text().toLowerCase() + " " + $description.text().toLowerCase(),
          // Maintain a reference to the jQuery object for each row, so we don't
          // have to create a new object inside the performance-sensitive keyup
          // handler.
          '$div': $option
        };
      }
      return options;
    },

    /**
     * Keyup handler for the search box that hides or shows the relevant
     * options.
     *
     * @param {jQuery.Event} event
     */
    handleKeyup: function (event) {
      var found;
      var option;
      var zebraClass;

      // Determine the user's search query. The search text has been converted
      // to lowercase.
      var search = this.$searchBox.val().toLowerCase();
      var words = search.split(' ');
      var wordsLength = words.length;

      // Start the counter for restriping rows.
      var zebraCounter = 0;

      // Search through the search texts in the form for matching text.
      var length = this.options.length;
      for (var i = 0; i < length; i++) {
        // Use a local variable for the option being searched, for performance.
        option = this.options[i];
        found = true;
        // Each word in the search string has to match the item in order for the
        // item to be shown.
        for (var j = 0; j < wordsLength; j++) {
          if (option.searchText.indexOf(words[j]) === -1) {
            found = false;
          }
        }
        if (found) {
          zebraClass = (zebraCounter % 2) ? 'odd' : 'even';
          // Show the checkbox row, and restripe it.
          option.$div.removeClass('even odd');
          option.$div.addClass(zebraClass);
          option.$div.show();
          zebraCounter++;
        }
        else {
          // The search string wasn't found; hide this item.
          option.$div.hide();
        }
      }
    }
  });

  /**
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiPreview = {
    attach: function (context) {
      // Only act on the edit view form.
      var $contextualFiltersBucket = $(context).find('.views-display-column .views-ui-display-tab-bucket.argument');
      if ($contextualFiltersBucket.length === 0) {
        return;
      }

      // If the display has no contextual filters, hide the form where you
      // enter the contextual filters for the live preview. If it has contextual
      // filters, show the form.
      var $contextualFilters = $contextualFiltersBucket.find('.views-display-setting a');
      if ($contextualFilters.length) {
        $('#preview-args').parent().show();
      }
      else {
        $('#preview-args').parent().hide();
      }

      // Executes an initial preview.
      if ($('#edit-displays-live-preview').once('edit-displays-live-preview').is(':checked')) {
        $('#preview-submit').once('edit-displays-live-preview').trigger('click');
      }
    }
  };

  /**
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiRearrangeFilter = {
    attach: function (context) {
      // Only act on the rearrange filter form.
      if (typeof Drupal.tableDrag === 'undefined' || typeof Drupal.tableDrag['views-rearrange-filters'] === 'undefined') {
        return;
      }
      var $context = $(context);
      var $table = $context.find('#views-rearrange-filters').once('views-rearrange-filters');
      var $operator = $context.find('.form-item-filter-groups-operator').once('views-rearrange-filters');
      if ($table.length) {
        new Drupal.viewsUi.RearrangeFilterHandler($table, $operator);
      }
    }
  };

  /**
   * Improve the UI of the rearrange filters dialog box.
   *
   * @constructor
   *
   * @param {jQuery} $table
   * @param {jQuery} $operator
   */
  Drupal.viewsUi.RearrangeFilterHandler = function ($table, $operator) {

    /**
     * Keep a reference to the `<table>` being altered and to the div containing
     * the filter groups operator dropdown (if it exists).
     */
    this.table = $table;

    /**
     *
     * @type {jQuery}
     */
    this.operator = $operator;

    /**
     *
     * @type {bool}
     */
    this.hasGroupOperator = this.operator.length > 0;

    /**
     * Keep a reference to all draggable rows within the table.
     *
     * @type {jQuery}
     */
    this.draggableRows = $table.find('.draggable');

    /**
     * Keep a reference to the buttons for adding and removing filter groups.
     *
     * @type {jQuery}
     */
    this.addGroupButton = $('input#views-add-group');

    /**
     * @type {jQuery}
     */
    this.removeGroupButtons = $table.find('input.views-remove-group');

    // Add links that duplicate the functionality of the (hidden) add and remove
    // buttons.
    this.insertAddRemoveFilterGroupLinks();

    // When there is a filter groups operator dropdown on the page, create
    // duplicates of the dropdown between each pair of filter groups.
    if (this.hasGroupOperator) {

      /**
       * @type {jQuery}
       */
      this.dropdowns = this.duplicateGroupsOperator();
      this.syncGroupsOperators();
    }

    // Add methods to the tableDrag instance to account for operator cells
    // (which span multiple rows), the operator labels next to each filter
    // (e.g., "And" or "Or"), the filter groups, and other special aspects of
    // this tableDrag instance.
    this.modifyTableDrag();

    // Initialize the operator labels (e.g., "And" or "Or") that are displayed
    // next to the filters in each group, and bind a handler so that they change
    // based on the values of the operator dropdown within that group.
    this.redrawOperatorLabels();
    $table.find('.views-group-title select')
      .once('views-rearrange-filter-handler')
      .on('change.views-rearrange-filter-handler', $.proxy(this, 'redrawOperatorLabels'));

    // Bind handlers so that when a "Remove" link is clicked, we:
    // - Update the rowspans of cells containing an operator dropdown (since
    //   they need to change to reflect the number of rows in each group).
    // - Redraw the operator labels next to the filters in the group (since the
    //   filter that is currently displayed last in each group is not supposed
    //   to have a label display next to it).
    $table.find('a.views-groups-remove-link')
      .once('views-rearrange-filter-handler')
      .on('click.views-rearrange-filter-handler', $.proxy(this, 'updateRowspans'))
      .on('click.views-rearrange-filter-handler', $.proxy(this, 'redrawOperatorLabels'));
  };

  $.extend(Drupal.viewsUi.RearrangeFilterHandler.prototype, /** @lends Drupal.viewsUi.RearrangeFilterHandler# */{

    /**
     * Insert links that allow filter groups to be added and removed.
     */
    insertAddRemoveFilterGroupLinks: function () {

      // Insert a link for adding a new group at the top of the page, and make
      // it match the action link styling used in a typical page.html.twig.
      // Since Drupal does not provide a theme function for this markup this is
      // the best we can do.
      $('<ul class="action-links"><li><a id="views-add-group-link" href="#">' + this.addGroupButton.val() + '</a></li></ul>')
        .prependTo(this.table.parent())
        // When the link is clicked, dynamically click the hidden form button
        // for adding a new filter group.
        .once('views-rearrange-filter-handler')
        .on('click.views-rearrange-filter-handler', $.proxy(this, 'clickAddGroupButton'));

      // Find each (visually hidden) button for removing a filter group and
      // insert a link next to it.
      var length = this.removeGroupButtons.length;
      var i;
      for (i = 0; i < length; i++) {
        var $removeGroupButton = $(this.removeGroupButtons[i]);
        var buttonId = $removeGroupButton.attr('id');
        $('<a href="#" class="views-remove-group-link">' + Drupal.t('Remove group') + '</a>')
          .insertBefore($removeGroupButton)
          // When the link is clicked, dynamically click the corresponding form
          // button.
          .once('views-rearrange-filter-handler')
          .on('click.views-rearrange-filter-handler', {buttonId: buttonId}, $.proxy(this, 'clickRemoveGroupButton'));
      }
    },

    /**
     * Dynamically click the button that adds a new filter group.
     *
     * @param {jQuery.Event} event
     */
    clickAddGroupButton: function (event) {
      // Due to conflicts between Drupal core's AJAX system and the Views AJAX
      // system, the only way to get this to work seems to be to trigger both
      // the mousedown and submit events.
      this.addGroupButton
        .trigger('mousedown')
        .trigger('submit');
      event.preventDefault();
    },

    /**
     * Dynamically click a button for removing a filter group.
     *
     * @param {jQuery.Event} event
     *   Event being triggered, with event.data.buttonId set to the ID of the
     *   form button that should be clicked.
     */
    clickRemoveGroupButton: function (event) {
      this.table.find('#' + event.data.buttonId).trigger('mousedown').trigger('submit');
      event.preventDefault();
    },

    /**
     * Move the groups operator so that it's between the first two groups, and
     * duplicate it between any subsequent groups.
     *
     * @return {jQuery}
     */
    duplicateGroupsOperator: function () {
      var dropdowns;
      var newRow;
      var titleRow;

      var titleRows = $('tr.views-group-title').once('duplicateGroupsOperator');

      if (!titleRows.length) {
        return this.operator;
      }

      // Get rid of the explanatory text around the operator; its placement is
      // explanatory enough.
      this.operator.find('label').add('div.description').addClass('visually-hidden');
      this.operator.find('select').addClass('form-select');

      // Keep a list of the operator dropdowns, so we can sync their behavior
      // later.
      dropdowns = this.operator;

      // Move the operator to a new row just above the second group.
      titleRow = $('tr#views-group-title-2');
      newRow = $('<tr class="filter-group-operator-row"><td colspan="5"></td></tr>');
      newRow.find('td').append(this.operator);
      newRow.insertBefore(titleRow);
      var length = titleRows.length;
      // Starting with the third group, copy the operator to a new row above the
      // group title.
      for (var i = 2; i < length; i++) {
        titleRow = $(titleRows[i]);
        // Make a copy of the operator dropdown and put it in a new table row.
        var fakeOperator = this.operator.clone();
        fakeOperator.attr('id', '');
        newRow = $('<tr class="filter-group-operator-row"><td colspan="5"></td></tr>');
        newRow.find('td').append(fakeOperator);
        newRow.insertBefore(titleRow);
        dropdowns = dropdowns.add(fakeOperator);
      }

      return dropdowns;
    },

    /**
     * Make the duplicated groups operators change in sync with each other.
     */
    syncGroupsOperators: function () {
      if (this.dropdowns.length < 2) {
        // We only have one dropdown (or none at all), so there's nothing to
        // sync.
        return;
      }

      this.dropdowns.on('change', $.proxy(this, 'operatorChangeHandler'));
    },

    /**
     * Click handler for the operators that appear between filter groups.
     *
     * Forces all operator dropdowns to have the same value.
     *
     * @param {jQuery.Event} event
     */
    operatorChangeHandler: function (event) {
      var $target = $(event.target);
      var operators = this.dropdowns.find('select').not($target);

      // Change the other operators to match this new value.
      operators.val($target.val());
    },

    /**
     * @method
     */
    modifyTableDrag: function () {
      var tableDrag = Drupal.tableDrag['views-rearrange-filters'];
      var filterHandler = this;

      /**
       * Override the row.onSwap method from tabledrag.js.
       *
       * When a row is dragged to another place in the table, several things
       * need to occur.
       * - The row needs to be moved so that it's within one of the filter
       * groups.
       * - The operator cells that span multiple rows need their rowspan
       * attributes updated to reflect the number of rows in each group.
       * - The operator labels that are displayed next to each filter need to
       * be
       *   redrawn, to account for the row's new location.
       */
      tableDrag.row.prototype.onSwap = function () {
        if (filterHandler.hasGroupOperator) {
          // Make sure the row that just got moved (this.group) is inside one
          // of
          // the filter groups (i.e. below an empty marker row or a draggable).
          // If it isn't, move it down one.
          var thisRow = $(this.group);
          var previousRow = thisRow.prev('tr');
          if (previousRow.length && !previousRow.hasClass('group-message') && !previousRow.hasClass('draggable')) {
            // Move the dragged row down one.
            var next = thisRow.next();
            if (next.is('tr')) {
              this.swap('after', next);
            }
          }
          filterHandler.updateRowspans();
        }
        // Redraw the operator labels that are displayed next to each filter, to
        // account for the row's new location.
        filterHandler.redrawOperatorLabels();
      };

      /**
       * Override the onDrop method from tabledrag.js.
       */
      tableDrag.onDrop = function () {
        // If the tabledrag change marker (i.e., the "*") has been inserted
        // inside a row after the operator label (i.e., "And" or "Or")
        // rearrange the items so the operator label continues to appear last.
        var changeMarker = $(this.oldRowElement).find('.tabledrag-changed');
        if (changeMarker.length) {
          // Search for occurrences of the operator label before the change
          // marker, and reverse them.
          var operatorLabel = changeMarker.prevAll('.views-operator-label');
          if (operatorLabel.length) {
            operatorLabel.insertAfter(changeMarker);
          }
        }

        // Make sure the "group" dropdown is properly updated when rows are
        // dragged into an empty filter group. This is borrowed heavily from
        // the block.js implementation of tableDrag.onDrop().
        var groupRow = $(this.rowObject.element).prevAll('tr.group-message').get(0);
        var groupName = groupRow.className.replace(/([^ ]+[ ]+)*group-([^ ]+)-message([ ]+[^ ]+)*/, '$2');
        var groupField = $('select.views-group-select', this.rowObject.element);
        if ($(this.rowObject.element).prev('tr').is('.group-message') && !groupField.is('.views-group-select-' + groupName)) {
          var oldGroupName = groupField.attr('class').replace(/([^ ]+[ ]+)*views-group-select-([^ ]+)([ ]+[^ ]+)*/, '$2');
          groupField.removeClass('views-group-select-' + oldGroupName).addClass('views-group-select-' + groupName);
          groupField.val(groupName);
        }
      };
    },

    /**
     * Redraw the operator labels that are displayed next to each filter.
     */
    redrawOperatorLabels: function () {
      for (var i = 0; i < this.draggableRows.length; i++) {
        // Within the row, the operator labels are displayed inside the first
        // table cell (next to the filter name).
        var $draggableRow = $(this.draggableRows[i]);
        var $firstCell = $draggableRow.find('td').eq(0);
        if ($firstCell.length) {
          // The value of the operator label ("And" or "Or") is taken from the
          // first operator dropdown we encounter, going backwards from the
          // current row. This dropdown is the one associated with the current
          // row's filter group.
          var operatorValue = $draggableRow.prevAll('.views-group-title').find('option:selected').html();
          var operatorLabel = '<span class="views-operator-label">' + operatorValue + '</span>';
          // If the next visible row after this one is a draggable filter row,
          // display the operator label next to the current row. (Checking for
          // visibility is necessary here since the "Remove" links hide the
          // removed row but don't actually remove it from the document).
          var $nextRow = $draggableRow.nextAll(':visible').eq(0);
          var $existingOperatorLabel = $firstCell.find('.views-operator-label');
          if ($nextRow.hasClass('draggable')) {
            // If an operator label was already there, replace it with the new
            // one.
            if ($existingOperatorLabel.length) {
              $existingOperatorLabel.replaceWith(operatorLabel);
            }
            // Otherwise, append the operator label to the end of the table
            // cell.
            else {
              $firstCell.append(operatorLabel);
            }
          }
          // If the next row doesn't contain a filter, then this is the last row
          // in the group. We don't want to display the operator there (since
          // operators should only display between two related filters, e.g.
          // "filter1 AND filter2 AND filter3"). So we remove any existing label
          // that this row has.
          else {
            $existingOperatorLabel.remove();
          }
        }
      }
    },

    /**
     * Update the rowspan attribute of each cell containing an operator
     * dropdown.
     */
    updateRowspans: function () {
      var $row;
      var $currentEmptyRow;
      var draggableCount;
      var $operatorCell;
      var rows = $(this.table).find('tr');
      var length = rows.length;
      for (var i = 0; i < length; i++) {
        $row = $(rows[i]);
        if ($row.hasClass('views-group-title')) {
          // This row is a title row.
          // Keep a reference to the cell containing the dropdown operator.
          $operatorCell = $row.find('td.group-operator');
          // Assume this filter group is empty, until we find otherwise.
          draggableCount = 0;
          $currentEmptyRow = $row.next('tr');
          $currentEmptyRow.removeClass('group-populated').addClass('group-empty');
          // The cell with the dropdown operator should span the title row and
          // the "this group is empty" row.
          $operatorCell.attr('rowspan', 2);
        }
        else if ($row.hasClass('draggable') && $row.is(':visible')) {
          // We've found a visible filter row, so we now know the group isn't
          // empty.
          draggableCount++;
          $currentEmptyRow.removeClass('group-empty').addClass('group-populated');
          // The operator cell should span all draggable rows, plus the title.
          $operatorCell.attr('rowspan', draggableCount + 1);
        }
      }
    }
  });

  /**
   * Add a select all checkbox, which checks each checkbox at once.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsFilterConfigSelectAll = {
    attach: function (context) {
      // Show the select all checkbox.
      $(context).find('#views-ui-handler-form div.form-item-options-value-all').once('filterConfigSelectAll')
        .show()
        .find('input[type=checkbox]')
        .on('click', function () {
          var checked = $(this).is(':checked');
          // Update all checkbox beside the select all checkbox.
          $(this).parents('.form-checkboxes').find('input[type=checkbox]').each(function () {
            $(this).attr('checked', checked);
          });
        });
      // Uncheck the select all checkbox if any of the others are unchecked.
      $('#views-ui-handler-form').find('div.js-form-type-checkbox').not($('.form-item-options-value-all'))
        .find('input[type=checkbox]')
        .on('click', function () {
          if ($(this).is('checked') === false) {
            $('#edit-options-value-all').prop('checked', false);
          }
        });
    }
  };

  /**
   * Remove icon class from elements that are themed as buttons or dropbuttons.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsRemoveIconClass = {
    attach: function (context) {
      $(context).find('.dropbutton').once('dropbutton-icon').find('.icon').removeClass('icon');
    }
  };

  /**
   * Change "Expose filter" buttons into checkboxes.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiCheckboxify = {
    attach: function (context, settings) {
      var $buttons = $('#edit-options-expose-button-button, #edit-options-group-button-button').once('views-ui-checkboxify');
      var length = $buttons.length;
      var i;
      for (i = 0; i < length; i++) {
        new Drupal.viewsUi.Checkboxifier($buttons[i]);
      }
    }
  };

  /**
   * Change the default widget to select the default group according to the
   * selected widget for the exposed group.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiChangeDefaultWidget = {
    attach: function () {
      function changeDefaultWidget(event) {
        if ($(event.target).prop('checked')) {
          $('input.default-radios').hide();
          $('td.any-default-radios-row').parent().hide();
          $('input.default-checkboxes').show();
        }
        else {
          $('input.default-checkboxes').hide();
          $('td.any-default-radios-row').parent().show();
          $('input.default-radios').show();
        }
      }

      // Update on widget change.
      $('input[name="options[group_info][multiple]"]')
        .on('change', changeDefaultWidget)
        // Update the first time the form is rendered.
        .trigger('change');
    }
  };

  /**
   * Attaches expose filter button to a checkbox that triggers its click event.
   *
   * @constructor
   *
   * @param {HTMLElement} button
   *   The DOM object representing the button to be checkboxified.
   */
  Drupal.viewsUi.Checkboxifier = function (button) {
    this.$button = $(button);
    this.$parent = this.$button.parent('div.views-expose, div.views-grouped');
    this.$input = this.$parent.find('input:checkbox, input:radio');
    // Hide the button and its description.
    this.$button.hide();
    this.$parent.find('.exposed-description, .grouped-description').hide();

    this.$input.on('click', $.proxy(this, 'clickHandler'));

  };

  /**
   * When the checkbox is checked or unchecked, simulate a button press.
   *
   * @param {jQuery.Event} e
   */
  Drupal.viewsUi.Checkboxifier.prototype.clickHandler = function (e) {
    this.$button
      .trigger('click')
      .trigger('submit');
  };

  /**
   * Change the Apply button text based upon the override select state.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiOverrideSelect = {
    attach: function (context) {
      $(context).find('#edit-override-dropdown').once('views-ui-override-button-text').each(function () {
        // Closures! :(
        var $context = $(context);
        var $submit = $context.find('[id^=edit-submit]');
        var old_value = $submit.val();

        $submit.once('views-ui-override-button-text')
          .on('mouseup', function () {
            $(this).val(old_value);
            return true;
          });

        $(this).on('change', function () {
          var $this = $(this);
          if ($this.val() === 'default') {
            $submit.val(Drupal.t('Apply (all displays)'));
          }
          else if ($this.val() === 'default_revert') {
            $submit.val(Drupal.t('Revert to default'));
          }
          else {
            $submit.val(Drupal.t('Apply (this display)'));
          }
          var $dialog = $context.closest('.ui-dialog-content');
          $dialog.trigger('dialogButtonsChange');
        })
          .trigger('change');
      });

    }
  };

  /**
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.viewsUiHandlerRemoveLink = {
    attach: function (context) {
      var $context = $(context);
      // Handle handler deletion by looking for the hidden checkbox and hiding
      // the row.
      $context.find('a.views-remove-link').once('views').on('click', function (event) {
        var id = $(this).attr('id').replace('views-remove-link-', '');
        $context.find('#views-row-' + id).hide();
        $context.find('#views-removed-' + id).prop('checked', true);
        event.preventDefault();
      });

      // Handle display deletion by looking for the hidden checkbox and hiding
      // the row.
      $context.find('a.display-remove-link').once('display').on('click', function (event) {
        var id = $(this).attr('id').replace('display-remove-link-', '');
        $context.find('#display-row-' + id).hide();
        $context.find('#display-removed-' + id).prop('checked', true);
        event.preventDefault();
      });
    }
  };

})(jQuery, Drupal, drupalSettings);
