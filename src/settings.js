// override post date formatting with a custom formatting string (for example: 'yyyy LLL dd')
// tokens are documented here: https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens
// if set, this takes precedence over include_time_with_date
exports.custom_date_formatting = '';

// categories to be excluded from post frontmatter
// this does not filter out posts themselves, just the categories listed in their frontmatter
exports.filter_categories = ['uncategorized'];
