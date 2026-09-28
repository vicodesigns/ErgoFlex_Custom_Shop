"""Connect the host invitation to physical AI, hardware, and workplace wellbeing."""
from pathlib import Path
from datetime import datetime
import shutil

folder = Path(__file__).resolve().parent
backup = folder / 'backups' / ('before-ai-event-copy-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True)
for name in ['tech-week-divi-code-module.html','ergoflex-editor.html','ergoflex-demos.html']:
    shutil.copy2(folder / name, backup / name)
p = folder / 'tech-week-divi-code-module.html'
s = p.read_text()
changes = {
 'Something your guests can try for themselves.': 'AI, with room to move.',
 'A desk moves at a spoken command. A guest tries the controls. A conversation begins. Invite ErgoFlex to your event for a hands-on experience with an adaptive workspace—and the inventor behind it. I’ll bring the desk and run the demo, so you can focus on your guests.': 'What happens when AI meets the place we spend our working day? ErgoFlex connects an adaptive desk with voice and vision interaction, personalized settings, and AI wellness coaching. Invite your guests to explore the intersection of intelligent hardware and everyday wellbeing—with a live demo led by its inventor.',
 'What it adds to your event': 'Physical AI · Connected hardware · Everyday wellbeing',
 'Something to try. Something to talk about.': 'From an AI conversation to a hands-on experience.',
 'Give guests a shared experience they can return to in conversation. ErgoFlex brings visible movement, hands-on interaction, and a founder’s story into the same space.': 'Your guests are already exploring what technology can do next. ErgoFlex offers one example they can try: a workspace that brings software, sensing, and physical movement into the routines of daily life.',
 '01 / DRAW PEOPLE IN': '01 / AI IN THE PHYSICAL WORLD',
 'Let curiosity bring them closer.': 'See an interaction become movement.',
 'Watch the desk rise, tilt, and respond to a voice command. It gives guests something happening right in front of them—and an invitation to step up and try it.': 'A spoken command adjusts the desk. Camera-based interaction offers another way to control it. Guests can explore how software, sensors, and mechanics work together in a product they can touch.',
 '02 / START A CONVERSATION': '02 / WELLBEING AT WORK',
 'Give strangers a shared starting point.': 'Make room for movement in the day.',
 'One guest tries the controls; another asks how it works. From connected hardware to workplace design, the desk gives founders, investors, and curious guests a concrete idea to discuss.': 'Try sitting, standing, and a tilted work surface. Explore how personal settings, movement routines, and AI wellness coaching are designed to encourage a more active workday. It’s a practical starting point for conversations about technology and wellbeing.',
 '03 / KEEP HOSTING SIMPLE': '03 / THE BUILDER BEHIND IT',
 'You host. I handle the desk.': 'Talk through the journey to launch.',
 'I bring ErgoFlex, set it up, guide guests through the experience, and collect it afterward. We agree on the space and demo window together, so it fits naturally into your program.': 'Meet the inventor of a desk with two issued U.S. patents and a third application submitted. Guests can ask about design decisions, connecting hardware and software, and bringing an idea into everyday use.',
 'See what your guests can experience.': 'A closer look at the interaction.',
 'Start with Vision control to see the desk respond. Then explore light and sound, voice control, recorded routines, and the LED inlay. We’ll choose the demonstrations that best fit your audience, room, and schedule.': 'Start with vision control, then explore light and sound, voice commands, recorded movement, and the LED inlay. These clips show the desk’s interaction and movement features; we’ll shape the live demonstration around your event.',
 'Fit the experience to your event.': 'Bring your event’s themes into the experience.',
 'Add a drop-in experience during networking, make room for a focused hardware conversation, or let coworking guests try a different way to work.': 'Whether your community is exploring physical AI, building hardware, or rethinking the working day, we can choose a format that complements your program.',
 'Reception or founder meetup': 'AI & founder conversations',
 'A staffed demo guests can explore between conversations. They try a control, see the desk move, and ask questions at their own pace. We plan the placement around your event flow.': 'Add a hands-on example to conversations about AI in the real world. During networking or a reception, guests can try the controls and discuss how intelligent products fit into daily life—with the inventor there to answer questions.',
 'Hardware or physical AI gathering': 'Hardware & physical AI meetups',
 'Pair a short demonstration with questions for the inventor. Give your builders and investors a tangible starting point for discussing mechanics, sensing, connected controls, and the journey to launch.': 'Give builders and investors a close look at the complete desk: powered lift and tilt, omnidirectional mobility, sensing, and connected controls. Pair a short demo with an open conversation about engineering and the path to launch.',
 'Coworking or creative community': 'Workspaces & wellbeing',
 'Offer a guided five-minute session: sit, stand, explore a tilted work surface, and save a preferred position. Guests get to imagine the desk in their own working day.': 'Offer a five-minute session where guests explore positions for their own work—from typing to drawing—and save a preferred setting. Open a conversation about movement habits, personal choice, and how technology can support the working day.',
 'I’m Victor “Vico” Hernandez, founder of Evolution X and inventor of ErgoFlex. I’d love to bring the final launch version to your LA Tech Week event. Send me your date, venue, and audience, and we’ll work out a demo format that complements what you’re planning.': 'I’m Victor “Vico” Hernandez, founder of Evolution X and inventor of ErgoFlex. I’d love to contribute a hands-on demonstration of the final launch version to your LA Tech Week event. I’ll handle transport, setup, guest demonstrations, and collection. Share your audience and program, and we’ll find the right fit.',
}
for a,b in changes.items():
    assert a in s,a
    s=s.replace(a,b)
p.write_text(s)
for name in ['build-editor.py','verify-editor.cjs']:
    p=folder/name
    s=p.read_text().replace('Something your guests can try for themselves.','AI, with room to move.').replace('Something your guests can try for themselves','AI, with room to move')
    s=s.replace('Let curiosity bring them closer.','See an interaction become movement.').replace('Reception or founder meetup','AI & founder conversations')
    p.write_text(s)
print('Updated event-focused AI, hardware, and wellbeing copy; backup preserved.')
