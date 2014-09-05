var CSSStyleLister = function() {
    var defaultCfg = {
        files: ""       // list of css files, comma delimited (spaces will be removed). If empty, use css files on page
    };

    var docTags =
        {"name":
            {label: "Name"
            ,isRequired: true       // skip comment if required tag is not there
            ,defaultText: "none"
            ,isSearchable: true
            }
        ,"example":
            {label: "Example"
            ,defaultText: "none"
            ,isMultiline: true
            }
        ,"tags":
            {label: "Tags"
            ,isFilter: true
            ,isCommaDelimited: true
            ,defaultText: "none"
            ,isSearchable: true
            }
        ,"authors":
            {label: "Authors"
            ,isFilter: true
            ,isCommaDelimited: true
            ,defaultText: "unknown"
            }
        ,"comments":
            {label: "Comments"
            ,isMultiline: true
            ,defaultText: "none"
            ,isSearchable: true
            }
//      ,"changed":
//          {label: "Changed"
//          ,defaultText: "unknown"
//          }
        };

    /* HELPER FUNCTIONS - not public */

    // return RegExp object based on a tag, for example pattern \@tags?\s([\s\S]*?)(@|\*\/)
    // single backslash in regexp string needs to be double backslash
    function _getRegExp(tag, isMultiline) {
        isMultiline = (isMultiline == true);
        var regExpStr = "\\@" + tag + "\\s*([\\s\\S]*?)";
        if (isMultiline) {
            regExpStr += "(@|\\*\\/)";      // TODO: a better way to figure out when a multiline value ends
        } else {
            regExpStr += "(@|\\n)";         // TODO: a better way to handle empty value tags without having to check for @ of next tag
        }
        var regExp = new RegExp(regExpStr, "gi");
        return regExp;
    }

    // trim leading and trailing spaces
    function _trimLeadTrailSpaces(s) {
        return s.replace(/(^\s*)|(\s*$)/gi,"");
    }

    // remove all spaces
    function _removeSpaces(s) {
        return s.replace(/\s/g,"");
    }

    // return a sorted array of keys for an object
    function _getSortedKeysArray(obj) {
        var arr = [];
        for (var key in obj) {
            arr.push(key);
        }
        return arr.sort();
    }

    function _htmlEncode(value){    // jQuery trick doesn't work with double quotes, so need to do it the long way
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "'")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }


    /* METHODS OF CLASS */

    return {
        /*
        *   initialize - if no css files passed in, the use css files included on page
        *   "cfg" parameters: files, templateHeader, templateLine
        */
        init: function(cfg) {
            // set cfg based on default and overrides
            this.cfg = {};
            $.extend(this.cfg, defaultCfg, (cfg || {}));

            // set files
            if (this.cfg.files == "") {
                for (var i=0; i < document.styleSheets.length; i++) {
                    if (document.styleSheets[i].href != null) {
                        this.cfg.files += (i > 0 ? "," : "") + document.styleSheets[i].href;
                    }
                }
            }
            this.filesArr = this.cfg.files.split(/\s*,\s*/);        // array of css files

            this.stylesArr = [];    // store all comments here
            this.stylesHash = {};   // store all comments here in hash, key = "cmt#"

            this.filteredTagCounts = {};    // store counts of filtered tags for different values - {tagName: {tagValNoSpecialChars: {label:tagVal, count:0, isPrimary: true/false}, ... }, ...}

            this.$elem = $("#csl");
            if (this.$elem.length == 0) {
                alert("Couldn't find element with id='csl'. Using 'body' tag instead.");
                this.$elem = $("body");
            }

            // read files and pull style comments
            this.readCSSFiles();

            this.$lastOpenPopup = null;
        }

        /*
        *   read list of css files with GET
        */
        ,readCSSFiles: function() {
            var self = this;
            for (var i=0; i < this.filesArr.length; i++) {
                var url = this.filesArr[i];
                this.$elem.append("<br/>Reading file " + url + "...");
                $.ajax(url, {
                    async: false
                    ,cache: false
                    ,dataType: "text"
                    ,error: function(jqXHR, textStatus, errorThrown) {
                        alert("Skipping file " + url + " due to error.\n\n(" + errorThrown.message + ")");
                        }
                    ,success: function(data, textStatus, jqXHR) {
                        self.parseComments(data, url);
                        self.$elem.append("<b>" + self.filteredTagCounts["file"][url].count + " documented styles</b>");
                        }
                    });
                }
        }

        /*
        *   parse out all comments from a string and add to this.stylesArr
        */
        ,parseComments: function(s, file) {

            var cmtCount = 0;
            var matchCSSComment = new RegExp(/\/\*\*[\s\S]*?\*\//g);    // non-greedy matching for comments
            var cssCmts = s.match(matchCSSComment);
            if (cssCmts == null) {
                this.addToFilteredTagCounts("file", file, false, 0);    // add file comment count 0
                return;
            }

            // parse each comment
            for (var i=0; i < cssCmts.length; i++) {
                var cssCmt = cssCmts[i];

                var style = null;
                for (var tagName in docTags) {
                    var currTag = docTags[tagName];
                    var regExp = _getRegExp(tagName, (currTag['isMultiline'] == true));
                    var match = cssCmt.match(regExp);

                    // if tag is required and no match, skip this comment
                    if (match == null && currTag['isRequired'] == true) {
                        style = null;
                        break;
                    }

                    if (style == null) {
                        style = {};
                    }
                    var tagVal = currTag['defaultText'];
                    if (match != null) {
                        var trimmedMatch = _trimLeadTrailSpaces(RegExp.$1);
                        if (trimmedMatch != "") {
                            tagVal = trimmedMatch;
                        }
                    }
                    style[tagName] = tagVal;

                    // if filtering, parse subvalues and count them up
                    if (currTag.isFilter == true) {
                        if (currTag.isCommaDelimited == true) {
                            var tagValArr = tagVal.split(/\s*,\s*/);    // split by commas, ignore spaces around comma
                            style[tagName] = tagValArr.join(", ");
                            style[tagName+"_Array"] = tagValArr;
                            for (var j=0; j<tagValArr.length; j++) {
                                var val = tagValArr[j];
                                this.addToFilteredTagCounts(tagName, val, (j==0));
                            }
                        } else {
                            this.addToFilteredTagCounts(tagName, tagVal, true);
                        }
                    }
                }
                if (style != null) {
                    cmtCount++;
                    var cmtId = "cmt" + this.stylesArr.length;
                    style["id"] = cmtId;
                    style["file"] = file;
                    this.stylesArr.push(style);
                    this.stylesHash[cmtId] = style;
                }
            }


            // add cmt counts to file
            this.addToFilteredTagCounts("file", file, false, cmtCount);

            // sort stylesArr by "name"
            this.stylesArr.sort(function(a,b) {
                if (a.name == null && b.name != null)
                    return -1;
                if (a.name != null && b.name == null)
                    return 1;
                if (a.name < b.name)
                    return -1;
                if (a.name > b.name)
                    return 1;
                return 0;
            });
        }

        ,render: function() {
            var self = this;
            if (this.stylesArr.length == 0) {
                this.$elem.html("Nothing matched");
                return;
            }
            // general structure
            this.$elem.html("<div id='csl-filter'></div>"
                    + "<div id='csl-results'>"
                        + "<div id='csl-filter-summary'></div>"
                        + "<div id='csl-results-format'>"
                            + "<a class='selected' href='#' onclick=\"CSSStyleLister.switchResultsStyle(this, 'grid-small')\">Small grid</a> | "
                            + "<a href='#' onclick=\"CSSStyleLister.switchResultsStyle(this, 'grid-large')\">Large grid</a> | "
                            + "<a href='#' onclick=\"CSSStyleLister.switchResultsStyle(this, 'list')\">List</a>"
                        + "</div>"
                        + "<div id='csl-results-area' class='csl-results-area-grid-small'></div>"
                    + "</div>");
            this.renderFilter();
            this.renderResults();

            // set resize event to make reset #csl-results width
            $(window).resize(function() {self.resizeWindow();} );
            this.resizeWindow();
        }

        ,renderFilter: function() {
            var self = this
                ,tmplFilterTag = "<div class='csl-tag-label'>#{tagName}</div><div class='csl-tag-list'><div>#{primaryValues}</div></div>"
                ,tmplFilterTagViewMore = "<a class='csl-view-more' href='#' onclick='CSSStyleLister.clickViewMore(this)'>View more</a><div class='csl-tag-more'>#{secondaryValues}</div>"
                ,tmplCheckbox = "<input type='checkbox' csl:tagname='#{tagName}' csl:value='#{tagValue}'> #{label} &nbsp; <span class='csl-val-count'>(#{count})</span><br/>";
            var markup = [];


            // search section
            var searchDesc = "";
            for (var tagName in docTags) {
                var currTag = docTags[tagName];
                if (currTag.isSearchable != true) {
                    continue;
                }
                searchDesc += (searchDesc == "" ? "" : ", ") + currTag.label;
            }
            if (searchDesc != "") {
                markup.push("<div class='csl-search-area'>Search &nbsp;<input type='text' id='csl-search'><div class='csl-search-desc'>within " + searchDesc + "<br>Space between terms, all must match<br><a href='#' id='csl-clear-all'>Clear all</a></div></div>");
            }


            // show filter for tags with "isFilter=true"
            for (var tagName in docTags) {
                var currTag = docTags[tagName];

                if (currTag.isFilter != true) {
                    continue;
                }
                var tagVals = this.filteredTagCounts[tagName]
                    ,tagValsSortedKeys = _getSortedKeysArray(tagVals)
                    ,primaryValues = ""
                    ,secondaryValues = "";

                for (var j=0; j < tagValsSortedKeys.length; j++) {
                    var valName = tagValsSortedKeys[j];
                    var tagVal = tagVals[valName];
                    if (tagVal.isPrimary == true) {
                        primaryValues += $.tmpl(tmplCheckbox, {tagName: tagName, tagValue: tagVal.label, label: tagVal.label, count: tagVal.count});    //TODO: HTMLEncode the values
                    } else {
                        secondaryValues += $.tmpl(tmplCheckbox, {tagName: tagName, tagValue: tagVal.label, label: tagVal.label, count: tagVal.count});  //TODO: HTMLEncode the values
                    }
                }
                markup.push($.tmpl(tmplFilterTag, {
                                tagName: currTag.label
                                ,primaryValues: primaryValues
                                }
                        )
                    );
                if (secondaryValues != "") {
                    markup.push($.tmpl(tmplFilterTagViewMore, {secondaryValues: secondaryValues}));
                }
            }

            // show filter for files
            primaryValues = "";
            for (var i=0; i < this.filesArr.length; i++) {
                var filename = this.filesArr[i];
                var shortFilename = filename.substring(this.filesArr[i].indexOf(".com/")+4);
                primaryValues += $.tmpl(tmplCheckbox, {tagName: "file", tagValue: filename, label: "<a class='csl-filter-filename' href='" + filename + "' target=_new>" + shortFilename + "</a>", count: this.filteredTagCounts["file"][filename].count});
            }
            markup.push($.tmpl(tmplFilterTag, {
                            tagName: "Files"
                            ,primaryValues: primaryValues
                            }
                    )
                );

            var extraFilterLinks = "<div class='csl-filter-more-links'><a href='http://www.salesforce.com/styleguide/'>Salesforce Style Guide</a></div>";

            if (extraFilterLinks != null) {
                markup.push($.tmpl(tmplFilterTag, {
                                tagName: "Other Resources"
                                ,primaryValues: extraFilterLinks
                                }
                        )
                    );
            }

            $("#csl-filter").html(markup.join(""));

            // set checkbox click events
            this.$filterCheckboxes = $("#csl-filter input[type='checkbox']");
            this.$filterCheckboxes.click(function() {
                self.filterResults();

            });

            // set clear all click
            $("#csl-clear-all").click(function() {
                $("#csl-search")[0].value = "";
                self.$filterCheckboxes.attr('checked', false);
                self.filterResults();
            });

            // set search box events
            if (searchDesc != "") {
                $(document).ready(function() {$("#csl-search").focus(); });
                $("#csl-search").keyup(function() {self.filterResults(); });
            }
        }

        /* show/hide items, assumes this.renderResults has already generated items */
        ,filterResults: function() {
            if (this.stylesArr.length == 0)
                return;

            var filterCount = 0;
            var filterDesc = "";
            var $currentlyChecked = this.$filterCheckboxes.filter(":checked");
            var searchTerm = "";
            if ($("#csl-search").length > 0) {
                searchTerm = $("#csl-search")[0].value;
            }
            if ($currentlyChecked.length == 0 && searchTerm == "") {
                filterCount = this.stylesArr.length;
                this.$cslItems.show();
                filterDesc = "All";
            } else {
                var filter = {};    // format is: {tagName: [selectedVal, ...], ...}
                $currentlyChecked.each(function(i) {
                    var $elem = $(this);
                    var tagName = $elem.attr("csl:tagname");
                    var val = $elem.attr("csl:value");
                    if (filter[tagName] == null) {
                        filter[tagName] = [];
                    }
                    filter[tagName].push(val);
                });
                var style = null;
                for (var i=0,len=this.stylesArr.length; i<len; i++) {
                    style = this.stylesArr[i];
                    if (this.isMatchedByFilter(style, filter, searchTerm)) {
                        $("#" + style["id"]).show();
                        filterCount++;
                    } else {
                        $("#" + style["id"]).hide();
                    }
                }
                // get filterDesc based on filter
                if (searchTerm != "") {
                    filterDesc += "Search term: " + searchTerm + "<br/>";
                }
                for (var tagName in filter) {
                    filterDesc += (tagName == "file" ? "File" : docTags[tagName].label) + ": " + filter[tagName].join(", ") + "<br/>";  // "filter.file" is not a real docTag, so just print the word File
                }
            }
            $("#csl-filter-summary").html(filterCount + " results <div class='csl-filter-desc'>" + filterDesc + "</div>");
        }

        ,renderResults: function() {
            var self = this;
            var tmplStyleItem = "<div id='#{id}' class='csl-item'> \
                    <div class='csl-details'> \
                        <div class='csl-name-outer'><a class='csl-show-details' href='#'>#{name}</a></div> \
                        <div class='csl-details-popup'> \
                            <div class='csl-name'><b>#{name}</b></div> \
                            <div class='csl-tags'><b>Tags:</b> #{tags}</div> \
                            <div class='csl-authors'><b>Authors:</b> #{authors}</div> \
                            <div class='csl-comments'><b>Comments:</b> #{comments}</div> \
                            <b>HTML</b> (to copy, or use Firebug in Firefox) \
                            <textarea class='csl-html-code'></textarea> \
                            <div class='csl-filename'><b>File:</b> <a href='#{file}' target=_new>#{file}</a></div> \
                        </div> \
                    </div> \
                    <div class='csl-example csl-clearfix'>#{example}</div> \
                </div> \
            ";


            var markup = [];
            for (var i=0,len=this.stylesArr.length; i<len; i++) {
                var style = this.stylesArr[i];
                var rowHtml = $.tmpl(tmplStyleItem, style);
                markup.push(rowHtml);
            }
            $("#csl-results-area").html(markup.join(""));


            this.$cslItems = $(".csl-item");


            $(".csl-details").hover(
                    function() {self.showDetails(this);}
                    ,function() {self.closePopup();}
            );

            // filter results will show/hide appropriate div.csl-item
            this.filterResults();

        }


        /* check if style is matched by the filter
           "filter" format is: {tagName: [selectedVal, ...], ...}
           Within tagName, OR operation.  Across tagNames, AND operation.  Search term needs to match at least one of the tags marked as isSearchable=true.
        */
        ,isMatchedByFilter: function(style, filter, searchTerm) {
            for (var tagName in filter) {
                var filterValArr = filter[tagName];
                var styleValArr = style[tagName + "_Array"];
                if (styleValArr == null) {
                    // if no array, then just compare values to single attribute on "style" (e.g. file filter)
                    var bFound = false;
                    var styleVal = style[tagName];
                    for (var i=0; i < filterValArr.length; i++) {
                        var filterVal = filterValArr[i];
                        if (filterVal == styleVal) {
                            bFound = true;
                            break;
                        }
                    }
                    if (!bFound) {
                        return false;   // didn't satisfy matching one of the tag values
                    }
                    continue;
                }
                var bFound = false;
                for (var i=0; i < filterValArr.length; i++) {
                    var filterVal = filterValArr[i];
                    if ($.inArray(filterVal, styleValArr) != -1) {
                        bFound = true;
                        break;
                    }
                }
                if (!bFound) {
                    return false;   // didn't satisfy matching one of the tag values
                }
            }

            // now check searchTerm to match at least one tag value on the search term. Multiple terms separated by space. AND multiple search terms.
            if (searchTerm != null && searchTerm != "") {
                var searchTermArr = _trimLeadTrailSpaces(searchTerm).split(" ");

                for (var i=0; i < searchTermArr.length; i++) {
                    var currSearchTerm = searchTermArr[i];
                    var bFound = false;
                    for (var tagName in docTags) {
                        var currTag = docTags[tagName];
                        if (currTag.isSearchable != true) {
                            continue;
                        }
                        var styleValArr = style[tagName + "_Array"];
                        if (styleValArr == null) {
                            // if no array, then just find searchTerm in attribute on "style"
                            var styleVal = style[tagName];
                            if (styleVal.indexOf(currSearchTerm) != -1) {
                                bFound = true;
                                break;
                            }
                            continue;
                        }
                        for (var j=0; j < styleValArr.length; j++) {
                            var styleVal = styleValArr[j];
                            if (styleVal.indexOf(currSearchTerm) != -1) {
                                bFound = true;
                                break;
                            }
                        }
                        if (bFound) {
                            break;
                        }
                    }
                    if (!bFound) {
                        return false;   // didn't satisfy matching one of the tag values
                    }
                }
            }
            return true;
        }


        /* update counts to variable "filteredTagCounts"
        */
        ,addToFilteredTagCounts: function(tagName, tagVal, isPrimary, forceCount) {
            var tagValScrubbed = _removeSpaces(tagVal);     //TODO: better scrubbing to remove special characters
            if (this.filteredTagCounts[tagName] == null) {
                this.filteredTagCounts[tagName] = {};
            }
            if (this.filteredTagCounts[tagName][tagValScrubbed] == null) {
                this.filteredTagCounts[tagName][tagValScrubbed] = {label: tagVal, count: 0, isPrimary: false};
            }
            if (!isNaN(parseInt(forceCount))) {
                this.filteredTagCounts[tagName][tagValScrubbed].count = forceCount;
            } else {
                this.filteredTagCounts[tagName][tagValScrubbed].count++;
            }
            if (isPrimary == true) {
                this.filteredTagCounts[tagName][tagValScrubbed].isPrimary = true;
            }
        }

        /* "view more" link shows next sibling element and hides itself
        */
        ,clickViewMore: function(linkElem) {
            $(linkElem).hide().next().show();
        }

        /* display style links change the css class on the items
        */
        ,switchResultsStyle: function(linkElem, displayStyle) {
            $("#csl-results-area").attr("class", "csl-results-area-" + displayStyle);
            $(linkElem).addClass("selected").siblings().removeClass("selected");
        }

        /* show details overlay
        */
        ,showDetails: function(linkElem) {
            var $item = $(linkElem).closest(".csl-item");   // go up to nearest ancestor .csl-item
            var $popup = $item.find(".csl-details-popup");
            var cmtId = $item.attr("id");
            var sameAsLast = (this.$lastOpenPopup != null && $item.attr("id") == this.$lastOpenPopup.closest(".csl-item").attr("id"));
            if (this.$lastOpenPopup != null) {
                this.closePopup();
            }
            $popup.closest(".csl-details").css("z-index", 5);
            var exampleHtml = (this.stylesHash[cmtId].example || "");
            exampleHtml = exampleHtml.replace(/(<br><|<br\/><)/ig, "\n<br/>\n\n<");    // change <br> to have a line return before and after (don't apply this if <br> is among text)
            $popup.find(".csl-html-code").html(_htmlEncode(exampleHtml));   // populate textarea with example html
            this.$lastOpenPopup = $popup.fadeToggle("fast");
        }

        /* close popup
        */
        ,closePopup: function(linkElem) {
            if (this.$lastOpenPopup != null) {  // only hide if different from a new link clicked
                this.$lastOpenPopup.hide();
                this.$lastOpenPopup.closest(".csl-details").css("z-index", 0);
                this.$lastOpenPopup = null;
            }
        }

        ,resizeWindow: function() {
            var w = Math.max(1200, $(window).width() - 40 - 50); // 40 is body margins, 50 for extra.  Don't go under 1200px width.
            $("#csl").css("width", w);
            $("#csl-results").css("width", w-300);
        }
    }

}();


CSSStyleLister.init();
CSSStyleLister.render();
