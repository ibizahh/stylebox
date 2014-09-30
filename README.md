
HIGH LEVEL VISION:

- To promote faster development (and secondarily, standardization and faster design) by reusing CSS styles that have been previous created.
- An small, agile and flexible framework that addresses issues facing a large group when trying to understand the styles being created (developers, designers, web producers).
- Value received by the documenter (i.e. developer) must be greater than the effort involved.
- Ability to start small and expand (versus a gigantic upfront effort).  Start with small/independent elements and work up to larger multi-component elements.
- Does not restrict design or programming creativity
- The functionality can easily be implemented and layout customized by any group or company.

USE CASES:

- Developer wants to reuse an existing style, if it closely matches what a designer has created.  For example a button, table style, etc
- Developer wants to see overview of existing styles, to see the variance and what to upgrade
- Developer does NOT want to spend more than 1 minute documenting the style.
- Designer wants to reuse existing styles when possible and needs to see what's in production
- Web producer wants to add a style to the content, e.g. list/table layout or button, quickly without developer support.
- QA wants to some visibility (dare I say "unit test") when css styles change
- QA wants to see cross-browser issues with new styles.

FEATURES:

- Documentation within CSS files using comments
	- Type / Types (comma delimited, case insensitive) - REQUIRED
	- Example HTML (most important) - REQUIRED
	- Tag / Tags (comma delimited, case insensitive)
	- Author / Authors (comma delimited, case insensitive)
	- Comment / Comments
	- LastModified
	- label names allow for plurals, no comments inside, no @ symbol
- The test page actual CSS files so it's showing what's in the "source".
- Dynamically generated page uses the current "css files" (not delayed, or mirrored)
- Filter by type, tags, author, filename
- Layout customization by including another css file
- Javascript file generates layout (not JSP or PHP)

COMMENT EXAMPLE:

```
	/**
		@Name 		button-style-1
		@Tags 		button, promo, df11, homepage, 
		@Authors		Stephen Kaiser, Leslie Chan
		@Changed 		03/23/2011
		@Comments 	This element requires CSS3PIE.
		@Example
			<div class="abc"><div class="xyz"></div></div>
	*/
```

LAYOUT EXAMPLE:
￼



KNOWN ISSUES:
- minimization required for production since the comments are so large.  (OR you can leave those comments in)
- css files have to be in the same domain as the tester page
- separate tester files for unrelated css (can't put everythingi n one file due to cascade effect)

TODO:
- create button in HTML Block to pull up this page
- way to load different css files based on page
- tagging parsing allows for @ in the values
