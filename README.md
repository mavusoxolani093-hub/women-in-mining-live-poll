# Women in Mining Live Poll

Static mobile poll and realtime presenter dashboard.

## Pages

- `index.html?q=1` - Which woman belongs in the mining industry?
- `index.html?q=2` - Are we still solving the same problem?
- `index.html?q=3` - One-word audience response
- `results.html` - Presenter results menu
- `results-1.html` - Dedicated result for question 1
- `results-2.html` - Dedicated result for question 2
- `results-3.html` - Dedicated live word-bubble result

## Enable realtime responses

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Copy the project URL and anon key into `config.js`.
4. Host this folder on GitHub Pages.
5. Put the public `index.html` URL into `publicPollUrl` in `../exact-html-slides/slide-qr.js`.

With empty Supabase settings, the site runs in local demo mode. Open the result page and question pages in separate tabs to test instant updates.

The third question is controlled by `thirdQuestion` in `config.js`.
