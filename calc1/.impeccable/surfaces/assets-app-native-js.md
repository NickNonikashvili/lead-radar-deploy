---
version: 1
slug: "assets-app-native-js"
primary_target: "assets/app-native.js"
related_targets: ["assets/app.css","assets/app-boot.js"]
---

# Mathub app shell (iOS and Android)

Scope: the native app's chrome and start screen (`assets/app.css`, `assets/app-native.js`, `assets/app-boot.js`, loaded only in the app). Mode: Operate. The website is untouched.
Audience and job: an MSU student opening the app between classes to keep a streak and do the next bit of one class.
Constraints: Big Sky world as recorded in DESIGN.md (white on sky ground, class colours, gold reward, coral exam, pine mastery, lips that press down, Gabarito numbers, Bo); safe areas; 48 dp targets; system Back; dark mode; Reduce motion; every website feature stays reachable.

## Direction contract

THESIS: The app opens on your classes and the winding path through one of them, a place you come back to daily; status at the top, five fat tabs at the bottom. It refuses the website arrangement: hero headline, sign-up buttons in a banner, sidebar, and a scroll of cards.

OWN-WORLD: Sky ground, white bars with 2px borders. Class colour owns the path: a sticky unit banner filled in it and round 72 px nodes on coloured lips. Gold flame and coin for streak and XP, coral flag nodes for exams, pine for mastered, Bo standing beside the current node. Everything pressable sinks onto its lip.

STORY: The student sees their streak, today's XP, which class they are in, and exactly which topic is next; taps START and is practising in one tap; switches class from the cards row or the class chip; the account sits top right.

FIRST VIEWPORT: App bar (class chip left, flame and XP centre-right, avatar or Sign in right). Under it the class cards row, then the unit banner and the first nodes, with the START bubble and Bo visible above the fold. Tab bar: Learn, Practice, Today, Board, Me.

FORM: Duolingo-style learning-path home with a class row above it ("Classes, then path"), chosen by the owner from three structures (path only, today first, classes then path); seed: owner's pick, no roll.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
