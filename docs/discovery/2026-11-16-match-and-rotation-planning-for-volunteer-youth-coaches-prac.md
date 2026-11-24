# Match and rotation planning for volunteer youth coaches: practice and comparable apps

## The question

How do volunteer coaches of youth teams (under 15, football and handball, Norway and the Nordics) plan matches and substitution rotations and share the plan today, and what do comparable apps offer? The answer is meant to feed the roadmap, as a short summary with a comparison. Training sessions and drills are out of scope, as the team confirmed.

coach-planner today is a client-only PWA with no backend or accounts (ADR 0001). State is in localStorage. A pure scheduler handles rotation, positions, locked history and pins. Sharing is a compressed URL opening `#/import`, and there is a print layout. Export/import between devices (#38) is related work.

## Findings

**Rotation planning is a crowded niche, mostly football-first and English-language.** Coach Meister generates equal-time rotation plans from a formation and per-player positions, includes goalkeeper turns, works offline with no login, offers a free browser tool for a printable plan, and can share a playing-time report with parents (https://www.coachmeister.com/, retrieved 2026-11-16). SubNow produces a plan targeting near-equal game time, recalculates after injuries or late arrivals, previews positions after each rotation and plans a half-time keeper swap (https://www.subnowapp.com/, 2026-11-16). Pitch Planner covers lineup builder, rotation interval, live per-player clocks and season minutes, with paid plans after a 7-day trial and an online sign-in (https://pitch-planner.app/, 2026-11-16). These cover the same ground as coach-planner's scheduler, positions and pins; the live-clock and in-match re-planning part is what differs.

**Fairness is sold as something to show parents.** Fairtime frames fair (not strictly equal) time with four player categories (always plays, preferred, equal rotation, needs minutes), a match record with a season position heatmap, and a no-login parent link during a match. It is invite-only in a pilot and aimed at UK volunteers (https://fairtime.football/, 2026-11-16). Coach Meister's parent report points the same way (https://www.coachmeister.com/, 2026-11-16). This bears on coach-planner's share link and print layout: the evidence suggests the plan is also a communication tool towards parents.

**Offline and no-account are common selling points.** CoachAny has no registration, ads, cloud sync, and works fully offline. It handles up to 18 field players and 1 to 4 periods, and its listing names handball among supported sports (https://apps.apple.com/no/app/coachany/id987231566, 2026-11-16). Coach Meister makes the same claims. coach-planner's no-backend design matches this expectation. A Norwegian-language review of CoachAny, from a user who says it is used on every match, asks for several teams and for reordering players (same address). That one review is thin evidence, but it shows Norwegian users in this niche.

**A Norwegian open-source PWA already does a similar job.** The "spilletid" repository describes a Norwegian-language, no-backend, localStorage PWA for youth football: squad entry by pasted lines, match settings, suggested substitutions, a clock, tournament-wide minutes per player, and separate teams for coaches with two teams (https://github.com/williamwmy/spilletid, 2026-11-16). It has 0 stars and 7 commits as shown, so it is evidence of the idea, not of demand.

**Handball tooling is thin and aimed at lineups, not rotation.** HandballTeamCreator offers drag-and-drop lineups with photos and multiple teams. It collects no data and has no purchases, but it has too few ratings to show an overview (https://apps.apple.com/us/app/handballteamcreator/id6747158405, 2026-11-16). Coach Tactic Board: Handball is a tactics, lineup and drill creator with a free tier and in-app purchases (https://apps.apple.com/us/app/coach-tactic-board-handball/id861263196, 2026-11-16). Learn Handball is a training-exercise service (https://www.learnhandball.com/en, 2026-11-16), which is outside this scope. Generic rotation apps such as CoachAny list handball among their sports. I found no handball-specific playing-time rotation planner in the collected pages.

**Team-admin apps own the sharing channel.** A comparison by ClipItCoach (a vendor, which declares its own interest) separates four jobs: who can play, who plays where, who gets the minutes, and telling everyone. It places Spond (free, football-only lineup in match events, visible to all invitees or only to hosts), TeamSnap (lineups on paid plans, a list with positions but no substitution plan) and others in the team-app group, and SubTime in the equal-minutes group. It advises against moving parents to a new app just for a better lineup screen. It lists prices: SubTime free for games up to 40 minutes, then about $2.49 a month; Pitchero, BenchApp and TeamSnap more (https://clipitcoach.com/blog/best-sports-lineup-apps, 2026-11-16). A plan therefore usually reaches parents through the app where the team already talks, which suggests a link or image that can be pasted into such channels.

**Team apps also exist in Europe, run on duty rotation rather than lineups.** Coach12, a Dutch app for youth football and hockey, manages fixtures, training, duties, carpools, attendance and playing time. It says it replaces WhatsApp and Excel for the team manager, stores first names only, on EU servers, and charges €2 per child (max €25 per season) (https://www.coach12.nl/en, 2026-11-16). That supports the claim that WhatsApp and Excel are the incumbent manual tools, but it is the vendor's own account.

**Vendors say paper and spreadsheets suit fixed plans and fail when plans change.** Pitch Planner's own comparison says paper and spreadsheets work when roster and rotation stay fixed, and a live tracker is better after a late arrival or injury. It also says a spreadsheet may be enough when the plan is fixed (https://pitch-planner.app/soccer-substitution-tracker-comparison/, 2026-11-16). SubNow's testimonials describe spreadsheets built to even out playing time as costly in hours (https://www.subnowapp.com/, 2026-11-16). These are vendor claims. Vanta Sports' guides describe club scheduling in Excel or Google Sheets with a WhatsApp message announcing changes (https://www.vantasports.ai/blog/sports-team-schedule-template, 2026-11-16), which concerns fixtures, not lineups, and is also vendor content.

### Comparison against coach-planner (as the pages state them)

| Capability | Coach Meister | SubNow | Pitch Planner | CoachAny | Spilletid (OSS) | coach-planner (per repo) |
|---|---|---|---|---|---|---|
| Pre-match rotation plan | yes | yes | yes | yes | yes | yes |
| Positions/formations | yes | yes | yes | drag-and-drop swaps | not stated | yes |
| Live clock / in-match re-plan | yes | yes | yes | yes | yes | not stated in the repo summary |
| Season/tournament minutes | not stated | not stated | yes | not stated | yes | not stated |
| Accounts needed | no | not stated | yes (sign-in) | no | no | no |
| Offline | yes | not stated | not stated | yes | PWA, localStorage | yes (PWA) |
| Sharing | printable plan, parent report | not stated | match info for parents (comparison page) | none (no cloud sync) | not stated | share URL, print |
| Norwegian UI | no (German available) | no | no | English listing | yes | not checked |

## What is uncertain or was not found

- **How Norwegian volunteer coaches actually work today.** No collected page gives survey or interview data on handwritten notes, Excel or WhatsApp use for under-15 football or handball in the Nordics. The practice claims above come from vendors and from non-Nordic sources. The team's own answer (everything manual: Excel, handwritten notes) is the only Nordic signal.
- **Handball specifics.** Nothing on handball rotation norms (for example unlimited flying substitutions, or whether playing-time fairness is a concern in this age group) was found.
- **Pricing and Nordic coverage.** Prices come from one vendor comparison checked in October 2026; no Nordic-language app other than the small open-source one was found. Spond's Nordic position is not established by these pages.
- **Feature gaps in the table** ("not stated") mean the fetched page was silent, not that the feature is absent. Two app-store pages (Google Play) were too large to fetch. The SubTime page fetched held only navigation text.
- **Most comparison material is published by vendors** (Pitch Planner, ClipItCoach, Coach Meister) on their own or rivals' products. A fetched Excel-template page (beeclassifieds) held no usable content.

## What was searched

These searches, approved by someone on the team, were sent to the search service (brave):

- `youth football coach substitution rotation planner app equal playing time`
- `handball lineup and rotation planner app for youth coaches`
- `how volunteer youth coaches plan lineups and share with parents Excel paper WhatsApp`
- `best lineup and substitution planning apps for youth soccer coaches comparison`
- `barnefotball trener bytteplan app spilletid rettferdig`

## Sources

The pages the run fetched, each once. Their text is not kept here: the hash is of the text as it was read. Each title is the page's own. What the search service answered is not kept, here or anywhere.

| Address | Title | Retrieved | SHA-256 of the text |
|---|---|---|---|
| https://www.coachmeister.com/ | Soccer Rotation Generator & Equal Playing Time Calculator | 2026-11-16T06:38:59Z | `72034236cb650d96f25c847bd7e1e20fb5d251fd578a556c0b9ba97d2a633168` |
| https://www.subtimeapp.com/ | SubTime / Youth Sports Coaching / Soccer Football Basketball Lacrosse | 2026-11-16T06:39:00Z | `42b19e18574469b633be490bd9b106bc3646610393ffd67c61e66c4c9c5d69f1` |
| https://www.subnowapp.com/ | SubNow | 2026-11-16T06:39:05Z | `6a2f6978dc68c4f64b0261038f67db1dd640a2a9edc8a729034599b5303d2810` |
| https://pitch-planner.app/ | Youth Soccer Substitution Tracker / Pitch Planner | 2026-11-16T06:39:06Z | `39fa0a0ab015307d1ab82c9bd177e1c615334c787e7286d2f65197f2a36b2dbe` |
| https://apps.apple.com/us/app/handballteamcreator/id6747158405 | ‎HandballTeamCreator App - App Store | 2026-11-16T06:39:11Z | `55e6ee10acfb1269a0212beb6fe38646f56d0460b2ead6b51e975ae7c809edba` |
| https://apps.apple.com/us/app/coachany/id987231566 | ‎CoachAny App - App Store | 2026-11-16T06:39:12Z | `0cd306fb2bb4f9f20bd2253a26021fbbca10d7c07d58ff56e3bc4f38ebff0ae6` |
| https://apps.apple.com/cr/app/coach-tactic-board-handball/id861263196?l=en-GB | ‎Coach Tactic Board: Handball App - App Store | 2026-11-16T06:39:14Z | `4275441594fc7281f77009b55c9793ab058522b8a811938b8a3db71a50566719` |
| https://apps.apple.com/us/app/coach-tactic-board-handball/id861263196 | ‎Coach Tactic Board: Handball App - App Store | 2026-11-16T06:39:16Z | `21710ad12a6abbd24ceed834ace416c01d1bff8bd9e4b5e9439881010cac6438` |
| https://www.learnhandball.com/en | Training plans and handball exercises for coaches / Learn Handball | 2026-11-16T06:39:17Z | `c4a8650b877c5598551b3498f6f23d24e6e3c25afaa11b4f02b907c5eb7cb986` |
| https://www.coach12.nl/en | Coach12 / Team app for youth football and hockey: duties, training, matches | 2026-11-16T06:39:21Z | `6acfea0aad1990cf6efc4e2261e407cc7c31e113c3662a884a065d7d8e036bb6` |
| https://www.vantasports.ai/blog/sports-team-schedule-template | Sports Team Schedule Template That Actually Works / Vanta Sports | 2026-11-16T06:39:23Z | `b0beba699ec382210af5e1e644ecabf06bcae8c0e3b92b5d4235cb5ead3ec44d` |
| https://www.vantasports.ai/blog/event-planning-excel-template-free | 10 Free Event Planning Excel Templates / Vanta Sports | 2026-11-16T06:39:24Z | `6a7b50199a2692f3088e55736f97a58f43938cfc6a6c360bc206a4e0587a55c6` |
| https://beeclassifieds.beenews.com/guide/044/1TW/HGrZOi/YouthFootballPracticeScheduleTemplateExcel | (no title) | 2026-11-16T06:39:26Z | `9ba3f67f4b4ab7580ccac4d770c3aa35c334fd0d7d17ad855c5b1a7162c98175` |
| https://www.vantasports.ai/blog/event-schedule-template | 10 Event Schedule Template Options for Youth Sports Clubs / Vanta Sports | 2026-11-16T06:39:27Z | `f34c95f45b31fed2e50ddc7b6a13397cd3871fa99ca57d5e679faf0f2c058c88` |
| https://pitch-planner.app/blog/best-youth-soccer-substitution-apps/ | 9 Best Soccer Substitution Apps for Youth Coaches | 2026-11-16T06:39:29Z | `7b485ca6963cb9ee126f8271e385b10894f889505fb434589d7a79292f731200` |
| https://pitch-planner.app/blog/digital-tools-coaches-manage-player-rotations/ | 9 Best Soccer Substitution Apps for Youth Coaches | 2026-11-16T06:39:31Z | `7b485ca6963cb9ee126f8271e385b10894f889505fb434589d7a79292f731200` |
| https://pitch-planner.app/soccer-substitution-tracker-comparison/ | Soccer Substitution Tracker: App vs Spreadsheet | 2026-11-16T06:39:33Z | `37c702d8e41e69c37e750932e5ae59e3c58576d5b92d26d607d409317a419bb9` |
| https://pitch-planner.app/blog/youth-soccer-substitution-apps/ | 9 Best Soccer Substitution Apps for Youth Coaches | 2026-11-16T06:39:35Z | `7b485ca6963cb9ee126f8271e385b10894f889505fb434589d7a79292f731200` |
| https://clipitcoach.com/blog/best-sports-lineup-apps | Best Sports Lineup Apps: Player Lineup Makers Compared | 2026-11-16T06:39:37Z | `c0aff65a0f57de81939f9335dbab7861d6679f59dd3266689c681737ce2f0570` |
| https://fairtime.football/ | Fairtime — Fair playing time, proven / Football substitution app | 2026-11-16T06:39:40Z | `6329f27cdefc8aed7738c5e653ddd1ad36a0e92c468866ea46f9c5368df2b3d5` |
| https://github.com/williamwmy/spilletid | GitHub - williamwmy/spilletid · GitHub | 2026-11-16T06:39:43Z | `d03c27c840a0813bbf198ee065eb6748b0fc2462478556e2d6f38f1eff9ac747` |
| https://apps.apple.com/no/app/coachany/id987231566 | ‎CoachAny App - App Store | 2026-11-16T06:39:43Z | `d3f0df070f38ecb8f834fca9b0288e90aae63eef4ca2b36be1938fd5951d3e0e` |

## Proposed issues

6 proposed, in [2026-11-16-match-and-rotation-planning-for-volunteer-youth-coaches-prac.issues.md](2026-11-16-match-and-rotation-planning-for-volunteer-youth-coaches-prac.issues.md). They are proposals: none is filed until this is merged by whoever approves that for the team.

<sub>Written by the researcher agent Team Platform runs for this team, from pages it was given: desk research, not checked by a person.</sub>
