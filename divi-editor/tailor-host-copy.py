"""One-time host copy revision, preserving the saved editor's media and layout."""
from pathlib import Path
from datetime import datetime
import re
import shutil

folder = Path(__file__).resolve().parent
editor = (folder / 'ergoflex-editor.html').read_text()
source = re.search(r'<template id="original-source">\s*([\s\S]*?)\s*</template>', editor).group(1)
changes = {
    'Your workspace. In sync with you.': 'Give your guests a reason to gather.',
    'LA Tech Week · October 12–18, 2026 · Demo collaborations': 'For LA Tech Week hosts · October 12–18, 2026',
    'Move from focused work to your next idea. ErgoFlex brings powered lift and tilt, omnidirectional mobility, and app and voice control into one adaptive workspace. Experience the final launch version at a live demo with its creator.': 'A desk moves at a spoken command. A guest tries the controls. A conversation begins. Bring ErgoFlex to your event for a hands-on experience with an adaptive workspace—and the inventor behind it. I’ll bring the desk and run the demo, so you can focus on your guests.',
    'Bring ErgoFlex to your event': 'Plan a guest demo',
    'See it in motion': 'Watch the desk in action',
    'Meet the builder: Victor “Vico” Hernandez · Founder, Evolution X · Huntington Beach, CA': 'Led by Victor “Vico” Hernandez · Inventor of ErgoFlex · Transport, setup, and demonstrations handled',
    'Designed around the way you work': 'What it adds to your event',
    'One workspace. A whole range of possibilities.': 'Something to try. Something to talk about.',
    'Change your position, your task, or your creative rhythm. ErgoFlex brings movement and personal control together, so your workspace can change with you.': 'Give guests a shared experience they can return to in conversation. ErgoFlex brings visible movement, hands-on interaction, and a founder’s story into the same space.',
    '01 / ADAPT': '01 / DRAW PEOPLE IN',
    'Find your angle.': 'Let curiosity bring them closer.',
    'Switch between sitting, standing, and a tilted surface for drawing or making. Powered lift and tilt let you adjust the desk to the task in front of you.': 'Watch the desk rise, tilt, and respond to a voice command. It gives guests something happening right in front of them—and an invitation to step up and try it.',
    '02 / CONTROL': '02 / START A CONVERSATION',
    'Make the next move yours.': 'Give strangers a shared starting point.',
    'Use the app or your voice to adjust the desk. Save preferred positions, explore camera-based interaction, and reposition the workspace with omnidirectional mobility.': 'One guest tries the controls; another asks how it works. From connected hardware to workplace design, the desk gives founders, investors, and curious guests a concrete idea to discuss.',
    '03 / CREATE': '03 / KEEP HOSTING SIMPLE',
    'Give your day a different rhythm.': 'You host. I handle the desk.',
    'Build repeatable movement routines and set the mood with integrated lighting. From recorded motion to sound-reactive LEDs, ErgoFlex makes the workspace part of the experience.': 'I bring ErgoFlex, set it up, guide guests through the experience, and collect it afterward. We agree on the space and demo window together, so it fits naturally into your program.',
    'See ErgoFlex in action': 'Picture it at your event',
    'Say it. Move it. Make it yours.': 'See what your guests can experience.',
    'A spoken command becomes physical movement. Lighting responds to sound. Saved positions become a repeatable routine. Watch five demonstrations of the technology behind ErgoFlex, then imagine putting it in your guests’ hands.': 'Start with voice control to see the desk respond. Then explore vision, lighting, and recorded movement. We’ll choose the demonstrations that best fit your audience, room, and schedule.',
    'Choose your demo format': 'A format for your gathering',
    'Give your guests a story they can step into.': 'Fit the experience to your event.',
    'For founders, it’s a conversation about building. For investors, a chance to meet the inventor and explore the product. For everyone else, it starts with a simple question: how would you make this workspace yours?': 'Add a drop-in experience during networking, make room for a focused hardware conversation, or let coworking guests try a different way to work.',
    'Turn curiosity into conversation': 'Reception or founder meetup',
    'Make ErgoFlex a hands-on destination at your reception or meetup. Guests try the controls, watch the desk change position, and discover how connected hardware can fit into everyday work.': 'A staffed demo guests can explore between conversations. They try a control, see the desk move, and ask questions at their own pace. We plan the placement around your event flow.',
    '<h3>Meet the builder</h3>': '<h3>Hardware or physical AI gathering</h3>',
    'Go from a live demo to a conversation with the inventor: mechanical design, connected controls, two issued patents, and the journey to launch. Bring your questions about the product and the business behind it.': 'Pair a short demonstration with questions for the inventor. Give your builders and investors a tangible starting point for discussing mechanics, sensing, connected controls, and the journey to launch.',
    '<h3>Find your workspace settings</h3>': '<h3>Coworking or creative community</h3>',
    'A guided five-minute session for coworking guests. Explore sitting, standing, and tilted positions, then try saving a setting that suits the way you work.': 'Offer a guided five-minute session: sit, stand, explore a tilted work surface, and save a preferred position. Guests get to imagine the desk in their own working day.',
    'Have another format in mind? Let’s shape a demo around your community, from a short introduction to a longer staffed session.': 'A scheduled demo window or a longer staffed session—let’s choose what works for your program.',
    'Bring the next workspace into the room.': 'Have a space in mind? Let’s talk.',
    'I’m Victor “Vico” Hernandez, founder of Evolution X and inventor of ErgoFlex. For LA Tech Week, I’d love to bring the final launch version to your community. I’ll handle transport, setup, demonstrations, and collection. Let’s give your guests something they can try—and a reason to keep talking.': 'I’m Victor “Vico” Hernandez, founder of Evolution X and inventor of ErgoFlex. I’d love to bring the final launch version to your LA Tech Week event. Send me your date, venue, and audience, and we’ll work out a demo format that complements what you’re planning.',
    'Let’s talk about your event': 'Discuss a demo for your event',
    'Send your event date, venue, and preferred demo window to info@ergoflexdesk.com.': 'Email info@ergoflexdesk.com with your event date, venue, audience, and preferred demo window.',
}
for before, after in changes.items():
    assert before in source, f'Expected current copy missing: {before}'
    source = source.replace(before, after)
source = source.replace('A conversation begins. Plan a guest demo for a hands-on experience', 'A conversation begins. Invite ErgoFlex to your event for a hands-on experience')
backup = folder / 'backups' / ('before-host-copy-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True)
for name in ['ergoflex-editor.html', 'tech-week-divi-code-module.html', 'ergoflex-demos.html']:
    shutil.copy2(folder / name, backup / name)
(folder / 'tech-week-divi-code-module.html').write_text(source)
print(f'Host copy updated. Previous files preserved at {backup}')
