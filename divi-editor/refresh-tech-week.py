"""Create the revised page without modifying the supplied original or its media."""
from pathlib import Path

folder = Path(__file__).resolve().parent
source = (folder / 'original-divi-code-module.html').read_text()
replacements = {
    'For LA Tech Week hosts & collaborators': 'LA Tech Week · October 12–18, 2026 · Demo collaborations',
    'Give your guests something they can actually try.': 'A workspace that moves with you.',
    'ErgoFlex is a moving, connected workspace. Bring the working prototype to your event for a hands-on conversation about hardware, human movement, and the future of work.': 'Sit. Stand. Tilt. Make it yours. ErgoFlex brings powered movement, sensing, and intuitive controls into one adaptive desk. Give your LA Tech Week guests a chance to try the prototype and meet the person building it.',
    'Discuss a live demo': 'Bring ErgoFlex to your event',
    'Watch the prototype': 'See it in motion',
    'Hosted by Victor “Vico” Hernandez · Founder, Evolution X · Huntington Beach, CA': 'Meet the builder: Victor “Vico” Hernandez · Founder, Evolution X · Huntington Beach, CA',
    'ERGOflex / IN MOTION': 'ERGOflex / WORKING PROTOTYPE',
    'Actual prototype + CES footage · 9-second montage': 'ErgoFlex in motion · Prototype + CES footage',
    'Moves in real time': 'One desk. More ways to work.',
    'Powered lift, tilt, and saved positions': 'Powered sitting, standing, tilt, and saved positions',
    'Responds to people': 'Connected to your next move.',
    'Voice, vision, proximity, light, and sound demos': 'Explore voice control, vision, and proximity sensing',
    'Built for conversation': 'Built to start conversations.',
    'Guests can see the system, try it, and meet its creator': 'Try the controls. Feel the movement. Meet the creator.',
    'The proof is in the movement': 'From the workshop',
    'See the working prototype.': 'Real hardware. Real movement.',
    'Short, unpolished clips from development show what the desk actually does. Choose a capability to watch.': 'Go inside the build: voice commands, camera-based control, responsive lighting, and recorded movement. These development clips show the working prototype in action. Start with voice control, then explore the other demonstrations.',
    'Prototype footage · Features and interfaces may evolve. Video loads only when you press play.': 'Development footage of the working prototype. Features and interfaces continue to evolve; live demonstrations are tailored to the venue.',
    'A look at camera-based tracking and vision control.': 'Explore camera-based tracking and how vision can become another way to interact with the desk.',
    'Integrated light and sound behavior in the prototype.': 'See how integrated lights and sound communicate responses from the desk.',
    'Addressable lighting responds to live audio.': 'Watch the LED inlay respond to audio, adding an expressive layer to the workspace.',
    'Saved positions play back as a sequence.': 'See recorded desk positions play back in sequence, turning individual adjustments into a repeatable routine.',
    'Where it fits': 'Choose your demo format',
    'An experience shaped around your gathering.': 'Your audience. Their hands on the controls.',
    'One physical product can give guests an easy way into different conversations. We can choose the format that fits your audience and program.': 'Give founders, investors, and curious builders a shared experience to talk about. Choose a format that fits your space and schedule.',
    'Walk-up discovery': 'A reason to gather',
    'A staffed, hands-on station for meetups and receptions. Guests see the desk move, try controls, and ask questions at their own pace.': 'A staffed demo for meetups and receptions. Guests stop by, try the controls, and see the desk transform while Vico answers questions.',
    'Hardware conversation': 'Meet the builder',
    'A live demonstration that opens discussion around mechanics, sensing, software, interaction, and the path from prototype to product.': 'A live demonstration followed by a conversation about mechanics, sensing, software, and bringing a physical product to life. A natural fit for hardware and physical AI communities.',
    'Five-minute fit session': 'Find your workspace settings',
    'A short guided experience for coworking guests to explore sitting, standing, and tilted work positions.': 'A guided five-minute session for coworking guests. Explore sitting, standing, and tilted positions, then try saving a setting that suits the way you work.',
    'Suitable for a scheduled demo window or a longer staffed activation, depending on venue and program.': 'Have another format in mind? Let’s shape a demo around your community, from a short introduction to a longer staffed session.',
    'Simple to bring in. Memorable to experience.': 'Let’s make room for a live demo.',
    'Vico can bring the desk, set it up, demonstrate it, and remove it afterward. Share your venue layout and timing, and we’ll find the right placement and demo window together.': 'I’m Vico, the creator of ErgoFlex. I’m looking for LA Tech Week hosts who want to give their guests a hands-on look at an adaptive workspace. I’ll handle delivery, setup, demonstrations, and collection. You bring the community; we’ll plan the experience together.',
    'Ask about a guest demo': 'Let’s talk about your event',
    'Email info@ergoflexdesk.com · No event commitment is implied until details are agreed.': 'Send your event date, venue, and preferred demo window to info@ergoflexdesk.com.',
    'Additional demonstration clearance agreed with your venue.': 'Minimum setup area. We’ll agree on extra movement and guest clearance with your venue.',
    'Omnidirectional wheels allow repositioning to suit the layout and event flow.': 'Omnidirectional wheels let us reposition the desk to suit your layout. We’ll coordinate loading access and power before arrival.',
    'Vico handles transport, setup, staffed demonstrations, and removal.': 'Vico handles transport, setup, staffed demonstrations, and removal. Timing and any venue requirements are agreed in advance.',
}
for before, after in replacements.items():
    assert before in source, before
    source = source.replace(before, after)

# Launch positioning and patent status supplied by the founder, September 23, 2026.
launch_copy = {
    'A workspace that moves with you.': 'Your workspace. In sync with you.',
    'Sit. Stand. Tilt. Make it yours. ErgoFlex brings powered movement, sensing, and intuitive controls into one adaptive desk. Give your LA Tech Week guests a chance to try the prototype and meet the person building it.': 'Move from focused work to your next idea. ErgoFlex brings powered lift and tilt, omnidirectional mobility, and app and voice control into one adaptive workspace. Experience the final launch version at a live demo with its creator.',
    'ERGOflex / WORKING PROTOTYPE': 'ERGOflex / IN MOTION',
    'ErgoFlex in motion · Prototype + CES footage': 'ErgoFlex in motion · Demonstration + CES footage',
    'Nine-second montage of ErgoFlex prototypes and CES event footage': 'Nine-second montage of ErgoFlex demonstrations and CES event footage',
    'One desk. More ways to work.': 'Two issued U.S. patents',
    'Powered sitting, standing, tilt, and saved positions': 'US 11,779,107 · US 12,708,198',
    'Connected to your next move.': 'Third application submitted',
    'Explore voice control, vision, and proximity sensing': 'The next chapter in the ErgoFlex patent portfolio',
    'Built to start conversations.': 'Experience the launch version',
    'Try the controls. Feel the movement. Meet the creator.': 'Try the desk. Explore the system. Meet its inventor.',
    'From the workshop': 'See ErgoFlex in action',
    'Real hardware. Real movement.': 'Say it. Move it. Make it yours.',
    'Go inside the build: voice commands, camera-based control, responsive lighting, and recorded movement. These development clips show the working prototype in action. Start with voice control, then explore the other demonstrations.': 'A spoken command becomes physical movement. Lighting responds to sound. Saved positions become a repeatable routine. Watch five demonstrations of the technology behind ErgoFlex, then imagine putting it in your guests’ hands.',
    'Development footage of the working prototype. Features and interfaces continue to evolve; live demonstrations are tailored to the venue.': 'Demonstration footage from across the ErgoFlex journey. Meet the final launch version at your event, with a live experience tailored to your audience and space.',
    'See spoken commands move the desk, with a proximity response in the working prototype.': 'Watch voice commands move the desk and see its proximity sensing respond during a demonstration.',
    'Your audience. Their hands on the controls.': 'Give your guests a story they can step into.',
    'Give founders, investors, and curious builders a shared experience to talk about. Choose a format that fits your space and schedule.': 'For founders, it’s a conversation about building. For investors, a chance to meet the inventor and explore the product. For everyone else, it starts with a simple question: how would you make this workspace yours?',
    'A reason to gather': 'Turn curiosity into conversation',
    'A staffed demo for meetups and receptions. Guests stop by, try the controls, and see the desk transform while Vico answers questions.': 'Make ErgoFlex a hands-on destination at your reception or meetup. Guests try the controls, watch the desk change position, and discover how connected hardware can fit into everyday work.',
    'A live demonstration followed by a conversation about mechanics, sensing, software, and bringing a physical product to life. A natural fit for hardware and physical AI communities.': 'Go from a live demo to a conversation with the inventor: mechanical design, connected controls, two issued patents, and the journey to launch. Bring your questions about the product and the business behind it.',
    'Let’s make room for a live demo.': 'Bring the next workspace into the room.',
    'I’m Vico, the creator of ErgoFlex. I’m looking for LA Tech Week hosts who want to give their guests a hands-on look at an adaptive workspace. I’ll handle delivery, setup, demonstrations, and collection. You bring the community; we’ll plan the experience together.': 'I’m Victor “Vico” Hernandez, founder of Evolution X and inventor of ErgoFlex. For LA Tech Week, I’d love to bring the final launch version to your community. I’ll handle transport, setup, demonstrations, and collection. Let’s give your guests something they can try—and a reason to keep talking.',
}
for before, after in launch_copy.items():
    assert before in source, before
    source = source.replace(before, after)

platform = '''
  <section id="ef-tech-platform" class="ef-section ef-fit" aria-labelledby="ef-tech-platform-title"><div class="ef-wrap">
    <div class="ef-section-head"><p class="ef-kicker">Designed around the way you work</p><h2 id="ef-tech-platform-title">One workspace. A whole range of possibilities.</h2><p>Change your position, your task, or your creative rhythm. ErgoFlex brings movement and personal control together, so your workspace can change with you.</p></div>
    <div class="ef-fit-grid">
      <article class="ef-fit-card"><span class="ef-num">01 / ADAPT</span><h3>Find your angle.</h3><p>Switch between sitting, standing, and a tilted surface for drawing or making. Powered lift and tilt let you adjust the desk to the task in front of you.</p></article>
      <article class="ef-fit-card"><span class="ef-num">02 / CONTROL</span><h3>Make the next move yours.</h3><p>Use the app or your voice to adjust the desk. Save preferred positions, explore camera-based interaction, and reposition the workspace with omnidirectional mobility.</p></article>
      <article class="ef-fit-card"><span class="ef-num">03 / CREATE</span><h3>Give your day a different rhythm.</h3><p>Build repeatable movement routines and set the mood with integrated lighting. From recorded motion to sound-reactive LEDs, ErgoFlex makes the workspace part of the experience.</p></article>
    </div>
  </div></section>
'''
source = source.replace('  <section id="ef-tech-videos"', platform + '  <section id="ef-tech-videos"', 1)
assert 'prototype' not in source.lower()

# Keep the existing selectors, DOM relationships, media, and video script intact.
palette = {
    '#092b3c': '#211526', '#061d2b': '#100d12', '#143042': '#251b2b',
    '#516675': '#63566b', '#e0f36b': '#f078ff', '#d9e4e7': '#e3d7e8',
    '#f4f7f6': '#faf6fb', '#e9f0ed': '#f2e7f5', '#cbd9d9': '#dfcde5',
    '#006a78': '#90219e', '#007788': '#a324b5', '#007185': '#90219e',
    '#f7faf9': '#fcf8fd', '#081c27': '#17101c', '#0a2937': '#211526',
    '#0d495217': '#65237017', '#d8e4e9': '#e5dae9', '#9bb1bc': '#c6b5ce',
    '#a9bec8': '#c6b5ce', '#d5e4e9': '#e5dae9', '#d7e3e8': '#e5dae9',
    '#a9c0ca': '#c6b5ce', '#b4c6ce': '#c6b5ce',
}
css, rest = source.split('</style>', 1)
for before, after in palette.items():
    css = css.replace(before, after)
css += '''
/* LA's magenta and black palette, adapted for ErgoFlex. */
#ef-tech .ef-top{background-color:var(--deep);background-image:radial-gradient(ellipse at 88% 20%,#b822cc24,transparent 56%),repeating-linear-gradient(90deg,transparent 0,transparent 71px,#ffffff05 72px)}
#ef-tech .ef-hero h1{max-width:620px;text-wrap:balance}
#ef-tech .ef-hero .ef-kicker{line-height:1.7;max-width:440px}
#ef-tech .ef-hero-stamp{max-width:calc(100% - 34px);letter-spacing:.06em}
#ef-tech .ef-hero-figure video{border:1px solid #ffffff30}
#ef-tech .ef-button-primary{box-shadow:0 4px 22px #dc4ce821}
#ef-tech .ef-button-primary:hover{filter:brightness(1.08)}
#ef-tech .ef-fit-card{border-top:3px solid var(--lime)}
#ef-tech .ef-proof-grid,#ef-tech .ef-section.ef-wrap{padding-left:30px;padding-right:30px}
@media(max-width:720px){#ef-tech .ef-proof-grid,#ef-tech .ef-section.ef-wrap{padding-left:20px;padding-right:20px}}
#ef-tech a:focus-visible,#ef-tech button:focus-visible{outline-color:#a324b5}
#ef-tech .ef-top a:focus-visible,#ef-tech .ef-top button:focus-visible,#ef-tech .ef-host a:focus-visible{outline-color:var(--lime)}
'''
source = css + '</style>' + rest
(folder / 'tech-week-divi-code-module.html').write_text(source)
print('Updated Tech Week module; original source and media preserved.')
