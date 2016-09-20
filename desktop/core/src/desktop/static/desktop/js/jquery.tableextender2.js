// Licensed to Cloudera, Inc. under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  Cloudera, Inc. licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function ($, window, document, undefined) {

  var PLUGIN_NAME = "jHueTableExtender2";

  var DEFAULT_OPTIONS = {
    fixedHeader: true,
    fixedFirstColumn: true,
    fixedFirstColumnTopMargin: 0,
    headerSorting: true,
    lockSelectedRow: true,
    firstColumnTooltip: false,
    classToRemove: 'resultTable',
    hintElement: null,
    mainScrollable: window,
    stickToTopPosition: -1,
    labels: {
      GO_TO_COLUMN: "Go to column:",
      PLACEHOLDER: "column name...",
      LOCK: "Click to lock row",
      UNLOCK: "Click to unlock row"
    }
  };

  function Plugin(element, options) {
    var self = this;
    self.disposeFunctions = [];

    self.lockedRows = {};
    self.setOptions(options); // Sets self.options

    self.$element = $(element);
    self.$parent = self.$element.parent();
    self.$mainScrollable = $(self.options.mainScrollable);

    self.drawHeader(); // Sets self.headerRowContainer
    self.drawFirstColumn(); // Sets self.firstColumnInner, self.firstColumnTopCell and self.firstColumn
    self.drawLockedRows();

    var lastHeight = -1;
    var currentHeight;

    var adjustSizes = function () {
      currentHeight = self.$parent.height();
      if (currentHeight != lastHeight) {
        self.firstColumnInner.height(self.$parent.get(0).scrollHeight);
        self.firstColumn.height(currentHeight);
        lastHeight = currentHeight;
      }

      self.headerRowContainer.width(self.$parent.width());
      self.thMapping.forEach(function (mapping) {
        if (mapping.clone.width() !== mapping.original.width()) {
          mapping.clone.width(mapping.original.width())
        }
      });
    };
    adjustSizes();
    var sizeInterval = window.setInterval(adjustSizes, 300);
    self.disposeFunctions.push(function () {
      window.clearInterval(sizeInterval);
    });

    var clickHandler = function () {
      if ($(this).hasClass('selected')) {
        self.$parent.find('.selected').removeClass('selected');
      } else {
        self.$parent.find('.selected').removeClass('selected');
        $(this).addClass('selected');
        self.$parent.find('.jHueTableExtenderClonedContainerColumn table tbody tr:eq(' + $(this).index() + ')').addClass('selected');
      }
    };
    self.$parent.on('click dblclick', 'table tbody tr', clickHandler);
    self.disposeFunctions.push(function () {
      self.$parent.off('click dblclick', 'table tbody tr', clickHandler);
    });

    var dblClickHandler = function () {
      huePubSub.publish('table.row.dblclick', {idx: $(this).index(), table: $(this).parents('table')});
    };
    self.$parent.on('dblclick', 'table tbody tr', dblClickHandler);
    self.disposeFunctions.push(function () {
      self.$parent.off('dblclick', 'table tbody tr', dblClickHandler);
    });

    self.repositionHeader();

    var scrollFunction;
    if (navigator.userAgent.toLowerCase().indexOf("firefox") > 0) {
      var ffThrottle = -1;
      var throttledPositionClones = function () {
        window.clearTimeout(ffThrottle);
        ffThrottle = window.setTimeout(self.repositionHeader.bind(self), 10);
      };
      scrollFunction = throttledPositionClones;
    } else {
      scrollFunction = self.repositionHeader.bind(self);
    }
    self.$mainScrollable.on('scroll', scrollFunction);
    self.disposeFunctions.push(function () {
      self.$mainScrollable.off('scroll', scrollFunction);
    });

    var firstCellWidth, leftPosition, $th;
    var throttledHeaderPadding = function () {
      firstCellWidth = self.options.fixedFirstColumn ? self.headerRowContainer.find("thead>tr th:eq(0)").outerWidth() : 0;
      self.headerRowContainer.find("thead>tr th").each(function () {
        $th = $(this);
        leftPosition = $th.position().left - firstCellWidth;
        if (leftPosition + $th.outerWidth() > 0 && leftPosition < 0) {
          if ($th.find('span').width() - leftPosition < $th.outerWidth() - 20) { // 20 is the sorting css width
            $th.find('span').css('paddingLeft', -leftPosition);
          }
        } else {
          $th.find('span').css('paddingLeft', 0);
        }
      });
    };

    var scrollTimeout = -1;
    var headerScroll = function () {
      self.headerRowContainer.scrollLeft(self.$parent.scrollLeft());
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(throttledHeaderPadding, 200);
    };
    self.$parent.on('scroll', headerScroll);
    self.disposeFunctions.push(function () {
      self.$parent.off('scroll', headerScroll);
    });

    self.$element.bind('headerpadding', function () {
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(throttledHeaderPadding, 200);
    });
    self.disposeFunctions.push(function () {
      self.$element.unbind('headerpadding');
    });
  }

  Plugin.prototype.destroy = function () {
    var self = this;
    self.disposeFunctions.forEach(function (disposeFunction) {
      disposeFunction();
    })
  };

  Plugin.prototype.setOptions = function (options) {
    if (typeof jHueTableExtenderGlobals != 'undefined') {
      var extendedDefaults = $.extend({}, DEFAULT_OPTIONS, jHueTableExtenderGlobals);
      extendedDefaults.labels = $.extend({}, DEFAULT_OPTIONS.labels, jHueTableExtenderGlobals.labels);
      this.options = $.extend({}, extendedDefaults, options);
      if (options != null) {
        this.options.labels = $.extend({}, extendedDefaults.labels, options.labels);
      }
    } else {
      this.options = $.extend({}, DEFAULT_OPTIONS, options);
      if (options != null) {
        this.options.labels = $.extend({}, DEFAULT_OPTIONS.labels, options.labels);
      }
    }
  };

  Plugin.prototype.repositionHeader = function () {
    var self = this;
    var pos = self.options.stickToTopPosition;
    var topPos = 0;
    if (typeof pos === 'function'){
      pos = pos();
    }
    if (pos > -1) {
      if (self.$element.offset().top < pos) {
        topPos = pos;
      } else {
        topPos = self.$element.offset().top;
      }
      self.firstColumn.css("top", self.$element.offset().top + "px");
    } else if (self.options.clonedContainerPosition == 'absolute') {
      topPos = self.$parent.position().top;
      self.firstColumn.css("top", topPos + "px");
    } else {
      topPos = self.$parent.offset().top;
      self.firstColumn.css("top", topPos + "px");
    }
    self.headerRowContainer.css("top", topPos + "px");
    self.firstColumnTopCell.css("top", topPos + "px");
  };

  Plugin.prototype.drawHeader = function () {
    var self = this;

    if (!self.$element.attr("id") && self.options.parentId) {
      self.$element.attr("id", "eT" + self.options.parentId);
    }

    $("#" + self.$element.attr("id") + "jHueTableExtenderClonedContainer").remove();
    var clonedTable = $('<table>').attr('class', self.$element.attr('class'));
    clonedTable.removeClass(self.options.classToRemove);
    clonedTable.css("margin-bottom", "0").css("table-layout", "fixed");
    var clonedTableTHead = $('<thead>');
    clonedTableTHead.appendTo(clonedTable);
    var clonedTableTR = self.$element.find('thead>tr').clone();
    clonedTableTR.appendTo(clonedTableTHead);
    $('<tbody>').appendTo(clonedTable);

    var clonedThs = clonedTable.find("thead>tr th");
    clonedThs.wrapInner('<span></span>');

    if (typeof self.$element.data('updateThWidthsInterval') !== 'undefined') {
      window.clearInterval(self.$element.data('updateThWidthsInterval'));
    }

    self.thMapping = [];
    var totalThWidth = 0;
    self.$element.find("thead>tr th").each(function (i) {
      var originalTh = $(this);
      originalTh.removeAttr("data-bind");
      var clonedTh = $(clonedThs[i]).css("background-color", "#FFFFFF").click(function () {
        originalTh.click();
        if (self.options.headerSorting) {
          clonedThs.attr("class", "sorting");
        }
        $(this).attr("class", originalTh.attr("class"));
      });
      clonedTh.width(originalTh.width());
      totalThWidth += originalTh.width();
      self.thMapping.push({
        original: originalTh,
        clone: clonedTh
      })
    });

    var headerRowDiv = $("<div>");
    clonedTable.appendTo(headerRowDiv);

    var topPosition;
    if (self.options.clonedContainerPosition == 'absolute') {
      topPosition = self.$parent.position().top - self.$mainScrollable.scrollTop();
    } else {
      topPosition = self.$parent.offset().top - self.$mainScrollable.scrollTop();
    }
    var headerRowContainer = $("<div>").attr("id", self.$element.attr("id") + "jHueTableExtenderClonedContainer")
        .addClass("jHueTableExtenderClonedContainer").width(totalThWidth).css("overflow-x", "hidden").css("top", topPosition + "px");
    headerRowContainer.css("position", self.options.clonedContainerPosition || "fixed");

    headerRowDiv.appendTo(headerRowContainer);
    headerRowContainer.prependTo(self.$parent);

    headerRowContainer.scrollLeft(self.$parent.scrollLeft());

    self.headerRowContainer = headerRowContainer;
  };

  Plugin.prototype.drawFirstColumn = function () {
    var self = this;
    if (! self.options.fixedFirstColumn) {
      self.firstColumnInner = $();
      self.firstColumnTopCell = $();
      self.firstColumn = $();
      return;
    }
    if (!self.$element.attr("id") && self.options.parentId) {
      self.$element.attr("id", "eT" + self.options.parentId);
    }

    var originalTh = self.$element.find("thead>tr th:eq(0)");
    var topPosition;
    if (self.options.clonedContainerPosition == 'absolute') {
      topPosition = self.$parent.position().top - self.$mainScrollable.scrollTop();
    } else {
      topPosition = self.$parent.offset().top - self.$mainScrollable.scrollTop();
    }

    $("#" + self.$element.attr("id") + "jHueTableExtenderClonedContainerCell").remove();
    var clonedCell = $('<table>').attr('class', self.$element.attr('class'));
    clonedCell.removeClass(self.options.classToRemove);
    clonedCell.css("margin-bottom", "0").css("table-layout", "fixed");
    var clonedCellTHead = $('<thead>');
    clonedCellTHead.appendTo(clonedCell);
    var clonedCellTH = originalTh.clone();
    clonedCellTH.appendTo(clonedCellTHead);
    clonedCellTH.width(originalTh.width()).css({
      "background-color": "#FFFFFF",
      "border-color": "transparent"
    });
    clonedCellTH.click(function () {
      originalTh.click();
    });
    $('<tbody>').appendTo(clonedCell);

    var clonedCellContainer = $("<div>").css("background-color", "#FFFFFF").width(originalTh.outerWidth());

    clonedCell.appendTo(clonedCellContainer);

    var firstColumnTopCell = $("<div>").attr("id", self.$element.attr("id") + "jHueTableExtenderClonedContainerCell").addClass("jHueTableExtenderClonedContainerCell").width(originalTh.outerWidth()).css("overflow", "hidden").css("top", topPosition + "px");
    firstColumnTopCell.css("position", self.options.clonedContainerPosition || "fixed");

    clonedCellContainer.appendTo(firstColumnTopCell);

    $("#" + self.$element.attr("id") + "jHueTableExtenderClonedContainerColumn").remove();
    var clonedTable = $('<table>').attr('class', self.$element.attr('class')).html('<thead></thead><tbody></tbody>');
    clonedTable.removeClass(self.options.classToRemove);
    clonedTable.css("margin-bottom", "0").css("table-layout", "fixed");
    self.$element.find("thead>tr th:eq(0)").clone().appendTo(clonedTable.find('thead'));
    var clonedTBody = clonedTable.find('tbody');
    var clones = self.$element.find("tbody>tr td:nth-child(1)").clone();
    var h = '';
    clones.each(function(){
      h+= '<tr><td>' + $(this).html() +'</td></tr>';
    });
    clonedTBody.html(h);
    if (self.options.lockSelectedRow) {
      clonedTBody.find('td').each(function(){
        var cell = $(this);
        cell.attr('title', self.options.labels.LOCK).addClass('lockable pointer').on('click', function(){
          self.drawLockedRow($(this).text()*1);
        });
        $('<i>').addClass('fa fa-lock muted').prependTo(cell);
      });
    }
    clonedTable.find("thead>tr th:eq(0)").width(originalTh.width()).css("background-color", "#FFFFFF");

    var firstColumnInner = $("<div>").css("background-color", "#FFFFFF").width(originalTh.outerWidth()).height(self.$parent.get(0).scrollHeight);
    clonedTable.appendTo(firstColumnInner);

    var firstColumn = $("<div>").attr("id", self.$element.attr("id") + "jHueTableExtenderClonedContainerColumn").addClass("jHueTableExtenderClonedContainerColumn").width(originalTh.outerWidth()).height(self.$parent.height()).css("overflow", "hidden").css("top", topPosition + "px");
    firstColumn.css("position", self.options.clonedContainerPosition || "fixed");

    firstColumnInner.appendTo(firstColumn);
    firstColumn.appendTo(self.$parent);

    firstColumnTopCell.appendTo(self.$parent);

    self.firstColumnInner = firstColumnInner;
    self.firstColumnTopCell = firstColumnTopCell;
    self.firstColumn = firstColumn;
  };

  Plugin.prototype.drawLockedRows = function (force) {
    var self = this;
    if (Object.keys(self.lockedRows).length === 0) {
      self.headerRowContainer.find('tbody').empty();
      self.headerRowContainer.removeClass('locked');
      self.firstColumnTopCell.removeClass('locked');
    } else {
      self.headerRowContainer.addClass('locked');
      self.firstColumnTopCell.addClass('locked');
      Object.keys(self.lockedRows).forEach(function (idx) {
        self.drawLockedRow(idx.substr(1), force);
      });
    }
  };

  Plugin.prototype.drawLockedRow = function (rowNo, force) {
    var self = this;

    function unlock($el) {
      self.headerRowContainer.find('tr td:first-child').filter(function () {
        return $(this).text() === rowNo + '';
      }).closest('tr').remove();
      delete self.lockedRows['r' + $el.text()];
      $el.parent().remove();
      if (self.headerRowContainer.find('tbody tr').length == 0) {
        self.headerRowContainer.removeClass('locked');
        self.firstColumnTopCell.removeClass('locked');
      }
    }

    if (Object.keys(self.lockedRows).indexOf('r' + rowNo) === -1 || force) {
      if (force) {
        unlock(self.lockedRows['r' + rowNo].cell.find('td'));
      }
      var $clone = $('<tr>').addClass('locked');
      var tHtml = '';
      var aoColumns = self.$element.data('aoColumns');
      self.$element.data('data')[rowNo - 1].forEach(function(col, idx){
        tHtml += '<td ' + (aoColumns && !aoColumns[idx].bVisible ? 'style="display: none"' : '') + '>' + col + '</td>';
      });
      $clone.html(tHtml);
      $clone.appendTo(self.headerRowContainer.find('tbody'));
      var $newTr = $('<tr>');
      $newTr.addClass('locked').html('<td class="pointer unlockable" title="' + self.options.labels.UNLOCK + '"><i class="fa fa-unlock muted"></i>' + rowNo + '</td>').appendTo(self.firstColumnTopCell.find('tbody'));
      $newTr.find('td').on('click', function () {
        unlock($(this));
      });
      self.lockedRows['r' + rowNo] = {
        row: $clone,
        cell: $newTr
      };
    } else {
      self.lockedRows['r' + rowNo].row.appendTo(self.headerRowContainer.find('tbody'));
      self.lockedRows['r' + rowNo].cell.appendTo(self.firstColumnTopCell.find('tbody'));
      self.lockedRows['r' + rowNo].cell.find('td').on('click', function () {
        unlock($(this));
      });
    }
  };

  $.fn[PLUGIN_NAME] = function (options) {
    return this.each(function () {
      if ($.data(this, 'plugin_' + PLUGIN_NAME)) {
        $.data(this, 'plugin_' + PLUGIN_NAME).destroy();
      }
      $.data(this, 'plugin_' + PLUGIN_NAME, new Plugin(this, options));
    });
  }
})(jQuery, window, document);
