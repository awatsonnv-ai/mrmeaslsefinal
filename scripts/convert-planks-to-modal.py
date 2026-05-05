#!/usr/bin/env python3
"""Convert platform plank accordion to native <dialog> modal overlay."""

import sys

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

original = html  # keep for diff stats

# ---------------------------------------------------------------------------
# 1. Card HTML: button+plank-body → icon+h3+trigger-button+dialog
# ---------------------------------------------------------------------------

cards = [
    {
        'body_id':   'body-the-more-the-merrier',
        'dialog_id': 'the-more-the-merrier',
        'icon':      '🎉',
        'title':     'The More the Merrier',
        'cta':       'Find your representative</a> and tell them where you stand on vaccine schedule, school MMR requirements, and herd immunity.',
    },
    {
        'body_id':   'body-protect-vaccine-schedule-reforms',
        'dialog_id': 'protect-the-vaccine-schedule-reforms',
        'icon':      '📋',
        'title':     'Protect the Vaccine Schedule Reforms',
        'cta':       'Find your representative</a> and tell them you support ACIP, the standard MMR schedule, and the pediatricians who follow it.',
    },
    {
        'body_id':   'body-cement-loss-of-elimination-status',
        'dialog_id': 'cement-the-loss-of-elimination-status',
        'icon':      '🏆',
        'title':     'Cement the Loss of Elimination Status',
        'cta':       'Find your representative</a> and tell them maintaining measles elimination status is a national priority — not a footnote.',
    },
    {
        'body_id':   'body-defund-the-cdc',
        'dialog_id': 'defund-the-cdc',
        'icon':      '💸',
        'title':     'Defund the CDC',
        'cta':       'Find your representative</a> and tell them where you stand on CDC funding, school vaccine requirements, and the MMR vaccine.',
    },
    {
        'body_id':   'body-defund-school-vaccination-requirements',
        'dialog_id': 'defund-school-vaccination-requirements',
        'icon':      '🏫',
        'title':     'Defund School Vaccination Requirements',
        'cta':       'Find your representative</a> and tell them you support strong, narrowly-exempted school vaccination requirements — at the state and federal level.',
    },
    {
        'body_id':   'body-end-vaccine-mandates',
        'dialog_id': 'end-vaccine-mandates',
        'icon':      '🚫💉',
        'title':     'End Vaccine Mandates',
        'cta':       'Find your representative</a> and tell them mandates are how we keep diseases like measles in the margins.',
    },
]

for c in cards:
    bid    = c['body_id']
    did    = c['dialog_id']
    icon   = c['icon']
    title  = c['title']
    cta    = c['cta']

    # --- opening: button wrapper + plank-body open div → bare icon/h3 + trigger + dialog open ---
    old_open = (
        f'        <button type="button" class="plank-trigger" aria-expanded="false" aria-controls="{bid}">\n'
        f'          <div class="card-icon">{icon}</div>\n'
        f'          <h3>{title}</h3>\n'
        f'          <span class="plank-read-cta">Read the full plank →</span>\n'
        f'        </button>\n'
        f'        <div id="{bid}" class="plank-body">'
    )
    new_open = (
        f'        <div class="card-icon">{icon}</div>\n'
        f'        <h3>{title}</h3>\n'
        f'        <button type="button" class="plank-trigger" aria-haspopup="dialog" aria-controls="plank-{did}">Read the full plank →</button>\n'
        f'        <dialog id="plank-{did}" class="plank-dialog" aria-labelledby="plank-{did}-title">\n'
        f'          <header class="plank-dialog-header">\n'
        f'            <h3 id="plank-{did}-title">{title}</h3>\n'
        f'            <button type="button" class="plank-dialog-close" aria-label="Close">×</button>\n'
        f'          </header>\n'
        f'          <div class="plank-dialog-body">'
    )
    assert old_open in html, f'ABORT: opening not found for {bid!r}'
    html = html.replace(old_open, new_open, 1)

    # --- closing: plank-body close + platform-card close → dialog-body close + dialog close + card close ---
    old_close = (
        f'            <p class="plank-cta"><a href="#cyr">{cta}</p>\n'
        f'        </div>\n'
        f'      </div>'
    )
    new_close = (
        f'            <p class="plank-cta"><a href="#cyr">{cta}</p>\n'
        f'          </div>\n'
        f'        </dialog>\n'
        f'      </div>'
    )
    assert old_close in html, f'ABORT: closing not found for {bid!r}\nLooked for:\n{old_close}'
    html = html.replace(old_close, new_close, 1)

print('Card HTML transforms: OK')

# ---------------------------------------------------------------------------
# 2. CSS: accordion rules → modal rules
# ---------------------------------------------------------------------------

old_css = (
    "    /* PLATFORM PLANKS — inline accordion */\n"
    "    .plank-trigger { width: 100%; display: flex; flex-direction: column; align-items: flex-start; background: transparent; color: inherit; border: none; padding: 0; cursor: pointer; font: inherit; text-align: left; flex-grow: 1; }\n"
    "    .plank-read-cta { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--red); margin-top: 12px; }\n"
    "    .platform-card:hover .plank-read-cta { text-decoration: underline; }\n"
    "    .plank-body { max-height: 0; overflow: hidden; transition: max-height 0.35s ease; }\n"
    "    .plank-body.is-open { max-height: 460px; overflow-y: auto; margin-top: 20px; }\n"
    "    .plank-body p { font-family: 'Open Sans', sans-serif; font-size: 15px; line-height: 1.75; color: #555; margin: 0 0 1em; }\n"
    "    .plank-body h4 { font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--navy); margin: 1.25rem 0 0.5rem; }\n"
    "    .plank-body ul { padding-left: 20px; margin: 0 0 1em; }\n"
    "    .plank-body li { margin-bottom: 0.5em; }\n"
    "    .plank-cta { margin-top: 1.5rem; font-weight: 600; }"
)

new_css = (
    "    /* PLATFORM PLANKS — modal dialog */\n"
    "    .plank-trigger { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--red); background: transparent; border: none; padding: 0; cursor: pointer; margin-top: 12px; text-align: left; }\n"
    "    .plank-trigger:hover { text-decoration: underline; }\n"
    "    .plank-dialog { border: none; border-radius: 8px; padding: 0; max-width: 720px; width: calc(100% - 2rem); max-height: 85vh; color: #1a1a1a; background: #fff; box-shadow: 0 25px 50px rgba(0,0,0,.35); }\n"
    "    .plank-dialog::backdrop { background: rgba(0,0,0,.7); backdrop-filter: blur(4px); }\n"
    "    .plank-dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem .75rem; border-bottom: 1px solid #eee; position: sticky; top: 0; background: #fff; z-index: 1; }\n"
    "    .plank-dialog-header h3 { margin: 0; font-size: 1.5rem; font-family: 'Oswald', sans-serif; color: var(--navy); }\n"
    "    .plank-dialog-close { background: transparent; border: none; font-size: 2rem; line-height: 1; cursor: pointer; padding: 0 .5rem; color: #666; }\n"
    "    .plank-dialog-close:hover { color: #000; }\n"
    "    .plank-dialog-body { padding: 1.5rem 2rem 2rem; overflow-y: auto; max-height: calc(85vh - 4.5rem); line-height: 1.7; font-size: 1rem; }\n"
    "    .plank-dialog-body h4 { margin: 1.5rem 0 .5rem; font-size: 1.1rem; font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--navy); }\n"
    "    .plank-dialog-body p { margin: 0 0 1em; font-family: 'Open Sans', sans-serif; font-size: 15px; line-height: 1.75; color: #555; }\n"
    "    .plank-dialog-body ul { padding-left: 20px; margin: 0 0 1em; }\n"
    "    .plank-dialog-body li { margin-bottom: .5em; }\n"
    "    .plank-cta { margin-top: 1.5rem; font-weight: 600; }\n"
    "    @media (max-width: 640px) {\n"
    "      .plank-dialog { max-width: 100%; width: 100%; max-height: 100vh; height: 100vh; margin: 0; border-radius: 0; }\n"
    "      .plank-dialog-body { max-height: calc(100vh - 4.5rem); }\n"
    "    }"
)

assert old_css in html, 'ABORT: plank CSS block not found'
html = html.replace(old_css, new_css, 1)
print('CSS transform: OK')

# ---------------------------------------------------------------------------
# 3. JS: accordion wiring → modal wiring
# ---------------------------------------------------------------------------

old_js = (
    "(function() {\n"
    "  document.querySelectorAll('.plank-trigger').forEach(function(btn) {\n"
    "    btn.addEventListener('click', function() {\n"
    "      var body = document.getElementById(btn.getAttribute('aria-controls'));\n"
    "      var isOpen = body.classList.contains('is-open');\n"
    "      body.classList.toggle('is-open');\n"
    "      btn.setAttribute('aria-expanded', String(!isOpen));\n"
    "      var cta = btn.querySelector('.plank-read-cta');\n"
    "      if (cta) cta.textContent = isOpen ? 'Read the full plank →' : '− Collapse';\n"
    "    });\n"
    "  });\n"
    "})();"
)

new_js = (
    "(function() {\n"
    "  document.querySelectorAll('.plank-trigger').forEach(function(btn) {\n"
    "    btn.addEventListener('click', function() {\n"
    "      var dialog = document.getElementById(btn.getAttribute('aria-controls'));\n"
    "      if (dialog && typeof dialog.showModal === 'function') dialog.showModal();\n"
    "    });\n"
    "  });\n"
    "  document.querySelectorAll('.plank-dialog-close').forEach(function(btn) {\n"
    "    btn.addEventListener('click', function() { btn.closest('dialog').close(); });\n"
    "  });\n"
    "  document.querySelectorAll('.plank-dialog').forEach(function(dialog) {\n"
    "    dialog.addEventListener('click', function(e) { if (e.target === dialog) dialog.close(); });\n"
    "  });\n"
    "})();"
)

assert old_js in html, 'ABORT: plank JS block not found'
html = html.replace(old_js, new_js, 1)
print('JS transform: OK')

# ---------------------------------------------------------------------------
# 4. Write output
# ---------------------------------------------------------------------------

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

added   = html.count('\n') - original.count('\n')
print(f'\nDone. Net line delta: {added:+d}')
print('SSR check: grep -c "my fellow viral particles" index.html')
