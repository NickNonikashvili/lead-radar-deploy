/* JPNS 150D: topic notes, key terms, flashcards, essay practice and checklists.
   Written for Mathub from standard background on Japanese history and literature and the readings on the
   syllabus. The professor's lectures, the readings and the films decide what the exams ask. */
const CANVAS = 'https://montana.instructure.com/';
const R = (pages) => ({ link: CANVAS, linkLabel: pages });

const SECTIONS = [
  /* ---------- Unit 1: origins to the Heian court ---------- */
  Object.assign({ id: 'intro', label: '1.1', title: 'Introduction: islands, myths and the Kojiki', unit: 1,
    ideas: [
      `Japan is an archipelago of four main islands (Honshū, Hokkaidō, Kyūshū, Shikoku) close enough to Korea and China to borrow from them and far enough to choose what to borrow. That rhythm of <b>borrowing and adapting</b> runs through the whole course.`,
      `The <b>Kojiki</b> (Record of Ancient Matters, 712) is Japan's oldest surviving book. It joins creation myths to a genealogy of the imperial line. The <b>Nihon shoki</b> (720) tells a similar story in a more Chinese, official style.`,
      `In the myth, the gods <b>Izanagi and Izanami</b> stir the sea with a jeweled spear and create the islands. Izanami dies giving birth to the fire god; Izanagi follows her to the land of the dead (Yomi), flees in horror and purifies himself.`,
      `From that purification come <b>Amaterasu</b> (the sun goddess), Tsukuyomi (the moon) and <b>Susanoo</b> (the storm god). Susanoo's rampages drive Amaterasu into a cave, plunging the world into darkness, until the gods lure her out. Her grandson Ninigi descends to rule, and the legendary first emperor, Jimmu, is his descendant.`,
      `Myths like these did political work: they made the imperial family the descendants of the sun goddess, and they show values that last, such as the importance of <b>purity and pollution</b>.`
    ],
    example: { p: `Why would an eighth-century court compile the Kojiki?`, s: `To give the ruling family a divine pedigree (descent from Amaterasu) and to set Japan's origins beside China's histories. The myths also record early beliefs about purity, death and the kami.` },
    pitfalls: [`Reading the Kojiki as history; it is myth with a political purpose.`, `Mixing up Amaterasu (sun, ancestor of the emperors) and Susanoo (storm, her unruly brother).`],
    tip: `For any myth, ask what it explains and whom it serves.` }, R('Reading: Craig pp. 1–11 and Kojiki excerpts (Canvas)')),

  Object.assign({ id: 'origins', label: '1.2', title: 'Origins, mythological and archaeological', unit: 1,
    ideas: [
      `<b>Jōmon</b> (c. 14,000–300 BCE): hunter-gatherers who made some of the world's oldest pottery, decorated with cord markings.`,
      `<b>Yayoi</b> (c. 300 BCE–250 CE): wet-rice farming, bronze and iron arrive from the continent through Korea, and with them settled villages and social ranks. Chinese records describe a queen, <b>Himiko</b>, ruling a land called Yamatai in the third century.`,
      `<b>Kofun</b> (c. 250–538): huge keyhole-shaped burial mounds ringed with clay figures (haniwa) show powerful chieftains. The <b>Yamato</b> clan, ancestors of the imperial family, rose to dominance.`,
      `Contact with China and Korea brought writing, Confucian ideas and Buddhism. <b>Prince Shōtoku</b> (574–622) promoted Buddhism and issued the Seventeen-Article Constitution; the <b>Taika Reforms</b> (645) copied the Chinese model of a centralized state.`,
      `The <b>Nara</b> period (710–794) had Japan's first permanent capital and the Great Buddha of Tōdai-ji. In 794 the court moved to <b>Heian-kyō</b> (Kyoto), opening the Heian period (794–1185).`
    ],
    example: { p: `What do the Kofun mounds tell us that the Kojiki does not?`, s: `Archaeology shows real, powerful chieftains with horses, weapons and mirrors buried in vast tombs. The Kojiki explains the rulers' power through divine descent; the mounds show it through labor and wealth.` },
    pitfalls: [`Putting Yayoi before Jōmon. Jōmon is first and much longer.`, `Thinking Japan copied China wholesale; it adapted what it borrowed, and dropped parts (such as the civil service exams).`],
    tip: `Learn the period names in order with one image each: Jōmon pots, Yayoi rice, Kofun mounds, Nara Buddha, Heian court.` }, R('Reading: Craig pp. 12–32')),

  Object.assign({ id: 'religions', label: '1.3', title: 'Religions: Shinto, Buddhism and Confucianism', unit: 1,
    ideas: [
      `<b>Shinto</b> ("the way of the kami") worships kami: the spirits of places, natural forces, ancestors and the sun goddess. It stresses <b>purity</b>; pollution (kegare) from death or blood is removed by purification rites. Shrines are marked by <b>torii</b> gates; the Ise Shrine honors Amaterasu.`,
      `<b>Buddhism</b> arrived from Korea in the sixth century (538 or 552). It is Mahayana Buddhism: all beings suffer through attachment, everything is impermanent, and buddhas and bodhisattvas help beings toward enlightenment.`,
      `Heian Buddhism: <b>Tendai</b> (Saichō, Mt. Hiei) and <b>Shingon</b> (Kūkai, Mt. Kōya, esoteric ritual). Belief in <b>mappō</b>, the age of the decline of the Buddhist law, spread from the eleventh century and fed the popularity of <b>Pure Land</b> Buddhism: calling on Amida Buddha's name (the nenbutsu) for rebirth in his paradise.`,
      `Shinto and Buddhism blended: kami were often treated as local forms of buddhas. Most Japanese have long drawn on both, often Shinto for life events and Buddhism for death.`,
      `<b>Confucianism</b> shaped ethics and government rather than worship: loyalty, filial piety, hierarchy and the duties of each role.`
    ],
    example: { p: `How does the Buddhist idea of impermanence show up in Japanese literature?`, s: `As mono no aware in Genji, the opening of the Heike ("the impermanence of all things"), Chōmei's river in the Hōjōki and Kenkō's praise of perishable beauty. Impermanence becomes both a source of sorrow and a source of beauty.` },
    pitfalls: [`Treating Shinto and Buddhism as rival churches; in practice they overlapped.`, `Confusing Pure Land (faith in Amida) with Zen (meditation), which came later, in the Kamakura period.`],
    tip: `Keep a list of where impermanence appears in each reading; it will feed several essays.` }, R('Lecture topic (week 3)')),

  Object.assign({ id: 'genji', label: '1.4', title: 'Murasaki Shikibu and The Tale of Genji', unit: 1,
    ideas: [
      `<b>The Tale of Genji</b> (early 1000s), by <b>Murasaki Shikibu</b>, a lady-in-waiting to Empress Shōshi, is often called the world's first novel: 54 chapters following the "shining" Prince Genji and, after his death, his descendants.`,
      `It was written in <b>kana</b>, the Japanese phonetic script used above all by court women, while men wrote official texts in Chinese. Women writers were at the center of Heian literature.`,
      `The Heian court valued refinement: poetry exchanges, calligraphy, the right color of paper and robes. Love affairs were conducted through poems and visits at night behind screens. Politics was dominated by the <b>Fujiwara</b> regents, who married daughters to emperors.`,
      `<b>"Yūgao"</b> (chapter 4): Genji takes up with Yūgao, a lowly, mysterious woman named for the evening-faces flower. He takes her to a deserted villa, where she dies in the night, apparently attacked by a spirit, often linked to his jealous lover Lady Rokujō. The chapter mixes romance, eeriness and grief.`,
      `<b>Mono no aware</b>, the "pathos of things", is a sensitivity to the passing of things: beauty is felt most sharply because it does not last. It is the emotional key of the Tale.`
    ],
    example: { p: `How does "Yūgao" show mono no aware?`, s: `Yūgao is like the flower she is named for: it blooms in the evening and fades by morning. Her sudden death turns a playful affair into grief, and Genji's sorrow, and his memory of her, are what make the episode beautiful.` },
    pitfalls: [`Calling Genji a "hero" in a modern moral sense; the Tale shows his charm and the harm he does.`, `Forgetting that the author is a woman writing in kana for a court audience.`],
    tip: `Learn three names: Genji, Yūgao and Lady Rokujō, and the term mono no aware.` }, R('Reading: “Yūgao” from The Tale of Genji (Keene)')),

  Object.assign({ id: 'pillow', label: '1.5', title: 'Sei Shōnagon and The Pillow Book', unit: 1,
    ideas: [
      `<b>The Pillow Book</b> (around 1000) is by <b>Sei Shōnagon</b>, lady-in-waiting to Empress Teishi, the rival court of Murasaki's empress.`,
      `It is a <b>zuihitsu</b> ("following the brush"): a miscellany of lists, sketches, anecdotes and opinions. It opens "In spring, the dawn" and moves through the best time of each season.`,
      `Its <b>lists</b> are famous: "Hateful things", "Things that make the heart beat faster", "Elegant things". They show a sharp, witty eye for detail and for social blunders.`,
      `Where Genji is steeped in aware (sorrowful sensitivity), the Pillow Book prizes <b>okashi</b>: the delightful, charming, amusing.`,
      `Murasaki's diary criticizes Sei Shōnagon as conceited and showy, the basis of their legend as rivals, though they likely served at court at slightly different times.`
    ],
    example: { p: `Compare the moods of Genji and The Pillow Book.`, s: `Genji is a long narrative of love and loss in the mood of mono no aware. The Pillow Book is a quick, witty miscellany in the mood of okashi. Both share the court's obsession with taste, seasons and fine distinctions.` },
    pitfalls: [`Calling The Pillow Book a novel; it is a miscellany.`, `Mixing up the two empresses: Murasaki served Shōshi, Sei Shōnagon served Teishi.`],
    tip: `Write your own list in Sei Shōnagon's style; it fixes the form in memory.` }, R('Reading: The Pillow Book excerpts (Keene)')),

  /* ---------- Unit 2: samurai, recluses and Noh ---------- */
  Object.assign({ id: 'samurai', label: '2.1', title: 'The rise of the samurai', unit: 2,
    ideas: [
      `In the late Heian period, provincial warrior bands grew powerful while the court relied on them. Two clans rose highest: the <b>Taira</b> (Heike) and the <b>Minamoto</b> (Genji).`,
      `The Taira, under <b>Taira no Kiyomori</b>, dominated the court. The <b>Genpei War</b> (1180–1185) ended with the Minamoto victory at <b>Dan-no-ura</b> (1185), where the child emperor Antoku drowned.`,
      `<b>Minamoto no Yoritomo</b> set up a military government, the <b>bakufu</b>, at Kamakura and took the title <b>shogun</b> (1192). The <b>Kamakura</b> period (1185–1333) began centuries of warrior rule with the emperor as a figurehead.`,
      `The Mongols invaded twice (1274 and 1281); storms, later called <b>kamikaze</b> ("divine winds"), helped wreck their fleets.`,
      `After a brief imperial restoration, the <b>Ashikaga</b> shoguns ruled from Kyoto (the <b>Muromachi</b> period, 1336–1573). The Ōnin War (1467–1477) began a century of civil war, the Warring States (Sengoku) period.`
    ],
    example: { p: `Why is 1185 a turning point?`, s: `The Minamoto defeated the Taira and soon set up the Kamakura shogunate. Real power passed from the court in Kyoto to warriors, while the emperor stayed on as a symbol, a pattern that lasted until 1868.` },
    pitfalls: [`Mixing up the clans' two names: Taira = Heike, Minamoto = Genji (no relation to the Genji of the Tale).`, `Thinking the shogun replaced the emperor; the emperor remained, without power.`],
    tip: `One line: Genpei War, Kamakura shogunate, Mongols, Muromachi, Ōnin War, Warring States.` }, R('Reading: Craig pp. 33–43')),

  Object.assign({ id: 'heike', label: '2.2', title: 'Warfare into literature: The Tales of the Heike', unit: 2,
    ideas: [
      `<b>The Tales of the Heike</b> (Heike monogatari) tells the rise and fall of the Taira. It was shaped over the thirteenth century by blind monks (<b>biwa hōshi</b>) who chanted it to the lute.`,
      `Its opening sets the theme: the bell of the Gion Monastery tolls the <b>impermanence of all things</b>; the proud do not last, like a dream on a spring night.`,
      `It is both a war epic and a Buddhist lesson: Kiyomori's pride and the Taira's fall show mujō (impermanence) and karma.`,
      `The <b>death of Atsumori</b>: at the battle of Ichi-no-tani (1184), the veteran Minamoto warrior <b>Kumagai Naozane</b> overpowers a young Taira noble, Atsumori, about the age of his own son. He must kill him, finds a flute on the body, and later becomes a Buddhist monk.`,
      `The Heike turned warfare into literature: courage and loyalty, but also grief, compassion and the futility of glory.`
    ],
    example: { p: `Why does Kumagai become a monk?`, s: `Killing a refined youth like his own son shows him the cruelty of the warrior's life. The flute marks Atsumori as cultured, and Kumagai's remorse turns him to Buddhism. Warrior honor meets Buddhist compassion.` },
    pitfalls: [`Reading the Heike only as glorifying war; its tone is elegiac.`, `Mixing up who wins: the Minamoto defeat the Taira (Heike).`],
    tip: `Memorize the opening's idea: the sound of the Gion bells, the impermanence of all things. It is the most quoted line in the course.` }, R('Reading: The Tales of the Heike excerpts (Keene)')),

  Object.assign({ id: 'hojoki', label: '2.3', title: 'Kamo no Chōmei’s Hōjōki: transcending chaos?', unit: 2,
    ideas: [
      `<b>Hōjōki</b> (1212), "An Account of My Ten-Foot Square Hut", by <b>Kamo no Chōmei</b> (1155–1216), a poet who left the world to live as a recluse.`,
      `It opens with the image of a river: the flow never stops, yet the water is never the same, like people and their houses.`,
      `Chōmei lists the disasters of his age: a great fire, a whirlwind, the move of the capital, famine and an earthquake. Cities and fortunes prove fragile.`,
      `He retires to a tiny hut in the hills near Kyoto, ten feet square, with only his books, lute and Buddhist images, and praises the freedom of owning almost nothing.`,
      `At the end he asks whether even his love of the hut is an attachment that Buddhism tells him to give up. The "transcending chaos?" question mark is the essay's own doubt.`
    ],
    example: { p: `Does Chōmei transcend the chaos of his age?`, s: `Partly. The hut frees him from the city's disasters and ambitions, but in the last lines he admits he is attached to his quiet life and his hut, so his escape is not complete. The honesty of that doubt is the essay's power.` },
    pitfalls: [`Treating the hut as a happy ending; the closing self-questioning matters.`, `Mixing up Chōmei (Hōjōki, 1212) and Kenkō (Essays in Idleness, about 1330).`],
    tip: `Two images carry the essay: the river and the hut.` }, R('Reading: “The Ten-Foot Square Hut” (Keene)')),

  Object.assign({ id: 'kenko', label: '2.4', title: 'Yoshida Kenkō: a worldly ascetic', unit: 2,
    ideas: [
      `<b>Essays in Idleness</b> (Tsurezuregusa, about 1330) is a zuihitsu by <b>Yoshida Kenkō</b>, a Buddhist priest who stayed close to court society: a "worldly ascetic".`,
      `It opens with the writer jotting down whatever crosses his mind to pass idle hours, a "strange, demented feeling".`,
      `Its key aesthetic: <b>perishability makes beauty</b>. If we lived forever, things would lose their power to move us. Should we look at cherry blossoms only in full bloom, or the moon only when it is cloudless?`,
      `Kenkō prizes the <b>incomplete and irregular</b>: the slightly worn, the unfinished, beginnings and endings over peaks. These ideas fed later tea and Zen aesthetics.`,
      `He mixes Buddhist detachment with a love of good taste, old customs and witty anecdotes.`
    ],
    example: { p: `Why is Kenkō called a "worldly ascetic"?`, s: `He took Buddhist vows and preaches detachment, yet he writes lovingly about court manners, good taste and the pleasures of the world. His detachment is aesthetic rather than a rejection of the world.` },
    pitfalls: [`Assuming Kenkō is gloomy; he finds impermanence beautiful.`, `Forgetting that "Essays in Idleness" and "Tsurezuregusa" are the same work.`],
    tip: `Quote the moon and cherry blossom question in any essay on Japanese aesthetics.` }, R('Reading: Essays in Idleness (Keene); Craig pp. 43–62')),

  Object.assign({ id: 'noh', label: '2.5', title: 'Noh drama and Zen aesthetics', unit: 2,
    ideas: [
      `<b>Noh</b> took shape in the fourteenth century under <b>Kan'ami</b> and his son <b>Zeami</b> (1363–1443), patronized by the shogun Ashikaga Yoshimitsu. Zeami wrote many plays and treatises on acting.`,
      `Its ideal is <b>yūgen</b>: a mysterious, profound, quiet grace. Movement is slow and stylized, with masks, chant (by a chorus) and flute and drums.`,
      `The <b>stage</b>: a square, roofed platform with a pine tree painted on the back wall and a bridgeway (hashigakari) along which actors enter. The main actor (<b>shite</b>), often masked, is frequently a ghost; the secondary actor (<b>waki</b>) is often a traveling priest.`,
      `<b>Atsumori</b> (attributed to Zeami): Kumagai, now the priest Rensei, returns to Ichi-no-tani to pray for the youth he killed. A reaper with a flute turns out to be Atsumori's ghost, who relives the battle, then forgives him: they will be reborn together.`,
      `<b>Zen</b> (Rinzai and Sōtō, from the Kamakura period) emphasized meditation and direct insight. Zen-linked arts of the Muromachi period include ink painting, dry rock gardens (Ryōan-ji) and the tea ceremony, with the aesthetics of <b>wabi</b> (rustic simplicity) and <b>sabi</b> (the beauty of age and loneliness).`
    ],
    example: { p: `How does the Noh Atsumori change the Heike's story?`, s: `The Heike tells the killing from Kumagai's side and ends with his remorse. The Noh lets the dead youth return as a ghost, relive the battle and forgive his killer, turning a war story into a Buddhist drama of release and reconciliation in the mood of yūgen.` },
    pitfalls: [`Mixing up shite (main role, often a ghost) and waki (secondary, often a priest).`, `Confusing Noh with kabuki or bunraku, which are later, popular theaters of the Edo period.`],
    tip: `Sketch the Noh stage once: pine wall, square stage, bridgeway. It is an easy multiple-choice question.` }, R('Reading: “Plan of the Noh Stage” and “Atsumori” (Keene)')),

  /* ---------- Unit 3: the Tokugawa peace and its end ---------- */
  Object.assign({ id: 'tokugawa', label: '3.1', title: 'The transition to Pax Tokugawa', unit: 3,
    ideas: [
      `Three "unifiers" ended the Warring States period: <b>Oda Nobunaga</b>, <b>Toyotomi Hideyoshi</b> (who unified Japan by 1590, disarmed commoners and invaded Korea) and <b>Tokugawa Ieyasu</b>.`,
      `Ieyasu won the battle of <b>Sekigahara</b> (1600) and became shogun in 1603, ruling from <b>Edo</b> (Tokyo). The Tokugawa kept the peace for about 250 years (1603–1868): the Pax Tokugawa.`,
      `Control: <b>alternate attendance</b> (sankin kōtai) made each daimyo live in Edo every other year and leave his family there; a <b>status order</b> ranked samurai, farmers, artisans and merchants.`,
      `Christianity was banned and the country largely closed (<b>sakoku</b>) from the 1630s: the Dutch and Chinese could trade only through Nagasaki.`,
      `Peace brought cities, roads, commerce and a rich urban culture, even though merchants officially ranked lowest. Samurai became bureaucrats, and Neo-Confucianism became the official ideology.`
    ],
    example: { p: `How did the Tokugawa keep the peace for 250 years?`, s: `By binding the daimyo through alternate attendance and hostages, freezing society into a status order, closing the country to most foreigners and Christianity, and backing it all with Confucian ideals of loyalty and hierarchy.` },
    pitfalls: [`Thinking "closed country" meant no trade at all; Dutch and Chinese trade continued at Nagasaki.`, `Assuming merchants stayed poor; they grew rich even though they ranked lowest.`],
    tip: `Unifiers in order: Nobunaga, Hideyoshi, Ieyasu.` }, R('Reading: Craig pp. 62–80')),

  Object.assign({ id: 'saikaku', label: '3.2', title: 'Ihara Saikaku and the chōnin ethos', unit: 3,
    ideas: [
      `The <b>chōnin</b> ("townspeople": merchants and artisans) of Osaka, Kyoto and Edo created a lively urban culture, especially in the Genroku era (1688–1704).`,
      `The <b>ukiyo</b>, the "floating world" of pleasure quarters, kabuki theaters and fashion, turned the Buddhist "sorrowful world" into a world of fleeting pleasure. Woodblock prints of it are ukiyo-e.`,
      `<b>Ihara Saikaku</b> (1642–1693), a poet turned prose writer, wrote "books of the floating world" (ukiyo-zōshi) about love and about money.`,
      `<b>"What the Seasons Brought the Almanac Maker"</b> (from Five Women Who Loved Love, 1686): an almanac maker's wife, Osan, and a clerk become lovers by accident, run away, and are caught and executed. Passion runs into law and duty.`,
      `<b>The Eternal Storehouse of Japan</b> (1688) tells how merchants make and lose fortunes, praising thrift, hard work and cleverness: a merchant ethic with comic edges.`
    ],
    example: { p: `What is the chōnin ethos in Saikaku?`, s: `Money is honorable if earned by thrift and wit, pleasure is part of life, and fortunes and love affairs are both fleeting. Saikaku writes about townspeople with humor, realism and an eye for cash.` },
    pitfalls: [`Reading ukiyo as purely Buddhist sorrow; in the Edo period it means pleasure-seeking.`, `Assigning the almanac maker story to Chikamatsu; it is Saikaku's.`],
    tip: `Saikaku = prose about townspeople's love and money; Chikamatsu = plays.` }, R('Reading: Saikaku, two stories (Keene)')),

  Object.assign({ id: 'chikamatsu', label: '3.3', title: 'Chikamatsu, bunraku and the domestic drama', unit: 3,
    ideas: [
      `<b>Bunraku</b> (jōruri) is puppet theater: large puppets, each worked by three puppeteers in view of the audience, with a chanter (tayū) who voices every role and a shamisen player.`,
      `<b>Chikamatsu Monzaemon</b> (1653–1725), Japan's great playwright, wrote for bunraku and kabuki: <b>history plays</b> (jidaimono) and <b>domestic plays</b> (sewamono) about ordinary townspeople.`,
      `<b>The Love Suicides at Sonezaki</b> (1703), based on a real event: Tokubei, a shop clerk, is cheated of money by his friend Kuheiji and disgraced. He and the courtesan Ohatsu, who love each other, walk to the Sonezaki woods and die together, hoping to be united in the next life.`,
      `The core conflict is <b>giri</b> (social duty and obligation) against <b>ninjō</b> (human feeling). The lovers' double suicide (shinjū) becomes a tragic, even beautiful, escape.`,
      `The play was so popular that copycat love suicides followed, and the shogunate later restricted such plays.`
    ],
    example: { p: `Explain giri and ninjō in The Love Suicides at Sonezaki.`, s: `Giri: Tokubei's duties to his employer and family and his need to clear his name. Ninjō: his love for Ohatsu. With money, honor and love impossible to reconcile in this world, the lovers choose death to be together.` },
    pitfalls: [`Calling bunraku kabuki; bunraku uses puppets and a chanter.`, `Forgetting the play's source in a real double suicide.`],
    tip: `Giri vs ninjō is the essay frame for both Chikamatsu and Saikaku's almanac maker.` }, R('Reading: Craig pp. 80–92; Chikamatsu (Keene)')),

  Object.assign({ id: 'basho', label: '3.4', title: 'Matsuo Bashō and the birth of haiku', unit: 3,
    ideas: [
      `<b>Matsuo Bashō</b> (1644–1694) turned haikai, a playful form of linked verse, into serious art. The opening verse of a linked chain (hokku), in 5-7-5 syllables, later became the independent <b>haiku</b> (a name given in the 1890s).`,
      `A haiku usually includes a <b>season word</b> (kigo) and a <b>cutting word</b> (kireji, such as ya or kana) that splits it into two images.`,
      `His most famous poem: an old pond, a frog jumps in, the sound of water. Stillness, sudden motion, and stillness again.`,
      `Bashō traveled as a poet-wanderer and wrote travel diaries mixing prose and haiku, above all <b>The Narrow Road to the Deep North</b> (Oku no hosomichi), from his 1689 journey.`,
      `His ideals include <b>sabi</b> (loneliness, the beauty of age) and, late in life, <b>karumi</b> ("lightness"). He took his name from the banana plant (bashō) by his hut.`
    ],
    example: { p: `How does the "old pond" haiku work?`, s: `The cutting word after "old pond" sets a still, timeless scene; the frog's jump and the sound of water break it for an instant. The poem catches a single moment of change against stillness, which is close to Zen insight.` },
    pitfalls: [`Treating haiku as just 5-7-5; the season word and the cut between two images matter more.`, `Calling Bashō's verses "haiku" in his own time; he wrote hokku within haikai.`],
    tip: `Memorize two or three haiku with their season words; essays need concrete quotations.` }, R('Reading: Bashō, selected haiku (Keene)')),

  Object.assign({ id: 'bakumatsu', label: '3.5', title: 'Bakumatsu: the decline of the shogunate', unit: 3,
    ideas: [
      `<b>Bakumatsu</b> means "the end of the bakufu": the years from 1853 to 1868.`,
      `Commodore <b>Matthew Perry</b> arrived with US warships (the "black ships") in 1853 and returned in 1854, forcing the Treaty of Kanagawa, which opened two ports.`,
      `The <b>Harris Treaty</b> (1858) and others were <b>unequal treaties</b>: foreigners gained extraterritoriality (they were tried in their own consular courts) and Japan lost control of its tariffs.`,
      `The shogun's weakness before the foreigners fed the slogan <b>sonnō jōi</b>, "revere the emperor, expel the barbarians". The domains of <b>Satsuma</b> and <b>Chōshū</b> allied against the Tokugawa.`,
      `The last shogun resigned in 1867, and in 1868 power was "restored" to the emperor: the Meiji Restoration. Japanese travelers' accounts of America from these years show a mix of curiosity, shock and calculation.`
    ],
    example: { p: `Why did Perry's arrival undermine the shogunate?`, s: `The shogun's main claim was keeping order and defending Japan. Signing treaties under threat showed he could do neither, and gave the emperor's supporters a cause, sonnō jōi, around which rival domains united.` },
    pitfalls: [`Thinking jōi (expelling foreigners) succeeded; the new government adopted Western ways instead.`, `Mixing up Perry (1853–54, opening) and Harris (1858, commercial treaty).`],
    tip: `Chain: black ships, unequal treaties, sonnō jōi, Satsuma–Chōshū, Restoration.` }, R('Reading: Craig pp. 92–101; Japan’s Discovery of America (Canvas)')),

  /* ---------- Unit 4: Meiji to the Occupation ---------- */
  Object.assign({ id: 'meiji', label: '4.1', title: 'The Meiji revolution', unit: 4,
    ideas: [
      `The <b>Meiji Restoration</b> (1868) put the young Emperor Meiji at the head of a new government run by samurai from Satsuma and Chōshū. The capital moved to Edo, renamed <b>Tokyo</b>.`,
      `Within a generation the domains were abolished (1871), the samurai class lost its privileges, conscription created a national army (1873) and a rebellion of discontented samurai (Satsuma, 1877) was crushed.`,
      `Slogans: <b>"rich country, strong army"</b> (fukoku kyōhei) and <b>"civilization and enlightenment"</b> (bunmei kaika): railways, factories, schools, Western dress and ideas.`,
      `The <b>Meiji Constitution</b> (1889) created a Diet but kept sovereignty with the emperor; the Imperial Rescript on Education (1890) taught loyalty and filial piety.`,
      `Japan became an imperial power: it defeated China (1894–95) and Russia (1904–05), took Taiwan and annexed Korea (1910). Emperor Meiji died in 1912.`
    ],
    example: { p: `Why is Meiji called a revolution rather than a restoration?`, s: `Although it claimed to restore the emperor, it abolished the samurai class and the domains, built a modern state, army and economy, and remade daily life in about thirty years: a revolution from above.` },
    pitfalls: [`Thinking the emperor ruled personally; oligarchs governed in his name.`, `Forgetting the speed: modernization took a single generation.`],
    tip: `Pair each slogan with an example: rich country (factories), strong army (conscription), civilization (Western dress and schools).` }, R('Reading: Craig pp. 101–119')),

  Object.assign({ id: 'soseki', label: '4.2', title: 'Natsume Sōseki and And Then', unit: 4,
    ideas: [
      `<b>Natsume Sōseki</b> (1867–1916), on the 1,000-yen note for years, studied in London (1900–02) and is the great novelist of Meiji Japan. Works include I Am a Cat, Botchan, Kokoro and <b>And Then</b> (Sorekara, 1909).`,
      `Sōseki saw Japan's modernization as forced from outside and superficial, leaving people anxious and divided between old duties and new individualism.`,
      `<b>And Then:</b> Daisuke, about thirty, lives in comfort on his wealthy father's money, refusing to work and cultivating his taste. Years ago he gave up Michiyo, whom he loved, to his friend Hiraoka, who married her.`,
      `When the unhappy Hiraokas return to Tokyo, Daisuke realizes he still loves Michiyo, refuses the marriage his family arranges, and confesses. His father disowns him, and he goes out into a city that seems to turn red, to find work.`,
      `Themes: the modern individual against family and society, love against obligation, and the cost of choosing for oneself.`
    ],
    example: { p: `Is Daisuke's choice a triumph or a disaster?`, s: `Both. He finally acts on his own feelings instead of his family's plans, which is a modern, individual choice, but it costs him his support, his friend and his comfort, and the novel ends on a burning, uncertain image.` },
    pitfalls: [`Reading Daisuke as simply lazy; his idleness is a critique of the workaday modern world.`, `Forgetting Sōseki's view that Japan's modernization was rushed and superficial.`],
    tip: `Know the triangle: Daisuke, Michiyo, Hiraoka.` }, R('Reading: Sōseki, And Then')),

  Object.assign({ id: 'taisho', label: '4.3', title: 'Taishō modernism and “Lemon”', unit: 4,
    ideas: [
      `The <b>Taishō</b> period (1912–1926) brought party politics ("Taishō democracy"), universal male suffrage (1925), department stores, cafés, cinema and the "modern girl" (moga).`,
      `The <b>Great Kantō Earthquake</b> (1923) destroyed much of Tokyo, which was rebuilt as a modern city.`,
      `Writers explored the self and the senses: the confessional "I-novel" (shishōsetsu), Akutagawa's stories, and modernist experiments.`,
      `<b>Kajii Motojirō</b>'s <b>"Lemon"</b> (1925): a narrator weighed down by an "ominous mass" of gloom buys a single lemon, whose color, scent and weight lift his mood. At the Maruzen bookstore he builds a pile of art books, sets the lemon on top like a bomb and walks away, imagining it blowing the store up.`,
      `"Lemon" shows Taishō modernism in miniature: urban alienation, a burst of sensory joy, and a private, playful rebellion against culture's weight.`
    ],
    example: { p: `What does the lemon mean in Kajii's story?`, s: `It is pure sensation, color, coolness and smell, that briefly cures the narrator's gloom. Left on the pile of books as an imaginary bomb, it becomes his private revolt against the heavy, imported culture of the bookstore.` },
    pitfalls: [`Missing the irony: the "bombing" happens only in his imagination.`, `Putting Taishō before Meiji; it follows Meiji (1912).`],
    tip: `Taishō = between Meiji's building and Shōwa's war: democracy, consumer culture and modernism.` }, R('Reading: Kajii Motojirō, “Lemon”')),

  Object.assign({ id: 'tanizaki', label: '4.4', title: 'Tanizaki’s In Praise of Shadows: reactionary aesthetics?', unit: 4,
    ideas: [
      `<b>Tanizaki Jun'ichirō</b> (1886–1965) began as an admirer of the West (Naomi) and later turned to Japanese tradition (The Makioka Sisters).`,
      `<b>In Praise of Shadows</b> (1933) argues that Japanese beauty lives in <b>shadow and dimness</b>, while Western beauty seeks brightness and clarity.`,
      `His examples: lacquerware glowing in candlelight, the dim recesses of a traditional room and alcove, the old-style toilet in its quiet outbuilding, the soft paper of shōji screens, gold leaf catching faint light.`,
      `He laments electric light, white tiles and Western fixtures that flood everything with glare, while admitting he cannot live without modern comforts.`,
      `The question mark in "reactionary aesthetics?" asks whether this is nostalgia for a lost Japan, a defense against Western dominance, a playful essay, or a cultural nationalism that fits the 1930s.`
    ],
    example: { p: `Is In Praise of Shadows reactionary?`, s: `In part: it idealizes the past and sets "Japanese" against "Western" taste in the nationalist 1930s. But it is also ironic and self-aware, admits its own contradictions, and offers a real insight into how light and shadow shape beauty.` },
    pitfalls: [`Reading the essay as a factual description of all Japanese homes.`, `Ignoring its humor and its admissions of contradiction.`],
    tip: `Have two concrete examples ready (lacquerware in candlelight, the toilet) for any essay.` }, R('Reading: Tanizaki, In Praise of Shadows')),

  Object.assign({ id: 'ww2', label: '4.5', title: 'Japan and World War II: victimizers?', unit: 4,
    ideas: [
      `Japan seized <b>Manchuria</b> in 1931 (the Manchurian Incident), set up the puppet state of Manchukuo and left the League of Nations (1933).`,
      `Full war with China began in 1937 (the Marco Polo Bridge incident), with atrocities such as the <b>Nanjing Massacre</b> (1937–38).`,
      `Japan attacked <b>Pearl Harbor</b> (December 7, 1941) and swept across Southeast Asia, then was pushed back after Midway (1942). The war ended after the atomic bombs on <b>Hiroshima</b> (August 6, 1945) and <b>Nagasaki</b> (August 9) and the Soviet entry into the war; the emperor announced the surrender on August 15.`,
      `The readings ask how Japanese writers faced Japan's role as <b>aggressor</b>. Hirabayashi Taiko's "Blind Chinese Soldiers" and Kojima Nobuo's "The Rifle" look at Chinese victims and at the Japanese soldier's life and mind.`,
      `"Victimizers?" and "Victims?" frame a debate that still shapes Japan's memory of the war: whether it remembers its own suffering more than the suffering it caused.`
    ],
    example: { p: `Why title the lectures "Victimizers?" and "Victims?"`, s: `Because Japan was both: an aggressor in China and Asia, and a victim of firebombing and the atomic bombs. The question marks ask how literature and memory balance the two, and whether stressing Japan's victimhood hides its aggression.` },
    pitfalls: [`Starting the war in 1941; for Japan it began in China in 1931 or 1937.`, `Treating the stories as simple propaganda for one side.`],
    tip: `Keep a two-column list: works that show Japan as victimizer, and works that show Japan as victim.` }, R('Reading: Craig pp. 124–140; Hirabayashi and Kojima (Canvas)')),

  Object.assign({ id: 'hiroshima', label: '4.6', title: 'War and pathos: Hiroshima and its memory', unit: 4,
    ideas: [
      `<b>Grave of the Fireflies</b> (1988, Takahata Isao, Studio Ghibli), from Nosaka Akiyuki's 1967 story: after the firebombing of Kobe in 1945, the teenage Seita and his little sister Setsuko try to survive on their own, and both starve to death. A film of pathos, not of battle.`,
      `<b>Hara Tamiki</b>'s <b>Summer Flowers</b> (1947) is a survivor's (hibakusha) account of the Hiroshima bombing: plain, stunned descriptions of the dead and dying. Hara took his own life in 1951.`,
      `The documentary <b>Hiroshima-Nagasaki, August 1945</b> uses footage filmed by Japanese crews after the bombings and long held by the US government.`,
      `The <b>Enola Gay controversy</b> (1995): the Smithsonian's plan for an exhibit on the plane that bombed Hiroshima, for the war's fiftieth anniversary, was attacked by veterans' groups and politicians for showing Japanese victims, and was cut back to the plane itself. The readings by Hogan examine it.`,
      `"War and representation": how a film, a memoir, a documentary or a museum frames the bombings shapes what nations remember and forget.`
    ],
    example: { p: `How do Grave of the Fireflies and the Enola Gay controversy both concern memory?`, s: `The film asks audiences to grieve for Japanese children, the victims' story; the Smithsonian dispute showed Americans resisting that story at their national museum. Both show that how the war is represented is a political choice.` },
    pitfalls: [`Thinking Grave of the Fireflies is about Hiroshima; it is about the firebombing of Kobe.`, `Forgetting that the Enola Gay controversy was American, in 1995.`],
    tip: `For memory essays, compare one Japanese work with the American Enola Gay debate.` }, R('Reading: Grave of the Fireflies; Hara; Hogan (Canvas)')),

  Object.assign({ id: 'occupation', label: '4.7', title: 'Occupation and beyond', unit: 4,
    ideas: [
      `The Allied <b>Occupation</b> (1945–1952), led by General <b>Douglas MacArthur</b> (SCAP), set out to demilitarize and democratize Japan.`,
      `The emperor renounced his divinity (January 1946) but kept his throne. War crimes trials were held in Tokyo.`,
      `The <b>1947 Constitution</b> made the emperor a symbol, gave women the vote and in <b>Article 9</b> renounced war. Land reform broke up landlord estates, and the big business groups (zaibatsu) were broken up for a time.`,
      `With the Cold War the US shifted to rebuilding Japan as an ally (the "reverse course"); the Korean War (1950–53) boosted its economy. The <b>San Francisco Treaty</b> ended the Occupation in 1952.`,
      `Then came the "economic miracle": rapid growth, the 1964 Tokyo Olympics and the bullet train, and a middle class pursuing education and consumer goods, the backdrop for the postwar works in the last unit.`
    ],
    example: { p: `What changed and what continued under the Occupation?`, s: `Changed: the constitution, Article 9, women's suffrage, land reform and the end of the military. Continued: the emperor stayed on the throne, much of the bureaucracy stayed in place, and the reverse course soon rebuilt big business.` },
    pitfalls: [`Thinking the emperor was removed; he stayed as a symbol.`, `Forgetting that the Occupation ended in 1952, not 1945.`],
    tip: `Article 9 is the single most cited fact about postwar Japan; know what it says.` }, R('Reading: Craig pp. 140–159')),

  /* ---------- Unit 5: postwar and contemporary Japan ---------- */
  Object.assign({ id: 'hijiki', label: '5.1', title: '“American Hijiki”: a bitter feast', unit: 5,
    ideas: [
      `<b>Nosaka Akiyuki</b> (1930–2015) lived through the firebombing and starvation he describes; "American Hijiki" and "A Grave of Fireflies" won the Naoki Prize together (1967).`,
      `In "American Hijiki", Toshio, a middle-aged man who works in television commercials, hosts an elderly American couple, the Higginses, visiting Japan.`,
      `Their visit stirs memories of the <b>Occupation</b>: hunger, GIs handing out chocolate, and the title's joke, when black tea from American relief supplies was mistaken for hijiki seaweed and cooked and eaten.`,
      `Toshio swings between servility and resentment, trying desperately to impress and entertain his American guest, a comic and painful portrait of a nation's mixed feelings toward its occupier.`,
      `"A bitter feast": food, hunger and humiliation tie the story to the war's legacy in prosperous 1960s Japan.`
    ],
    example: { p: `What does the "American hijiki" stand for?`, s: `Foreign aid misunderstood: the starving Japanese took American tea for seaweed and boiled it, a funny, sad memory of dependence and confusion under the Occupation that still shapes Toshio's anxious hospitality decades later.` },
    pitfalls: [`Reading the story as anti-American only; it mocks Toshio's own insecurity just as much.`, `Mixing up its date (1967) with the Occupation it remembers (1945–52).`],
    tip: `Link to Grave of the Fireflies: the same author, the same hunger, different tones.` }, R('Reading: Nosaka, “American Hijiki” (Canvas)')),

  Object.assign({ id: 'familygame', label: '5.2', title: 'The Family Game', unit: 5,
    ideas: [
      `<b>The Family Game</b> (Kazoku gēmu, 1983), directed by <b>Morita Yoshimitsu</b>, satirizes a middle-class family in a Tokyo-area apartment.`,
      `The Numata family hires an odd, aggressive tutor, Yoshimoto, to get their underachieving younger son through high-school entrance exams.`,
      `Its signature image: the family eating <b>side by side at a long table</b>, all facing the camera, not each other, like a row of strangers. It ends in a chaotic dinner the tutor wrecks.`,
      `Targets: <b>"exam hell"</b> (juken jigoku), the absent salaryman father, the mother who manages everything, and a family held together by appearances and ambition.`,
      `It shows the cost of the economic miracle: material comfort, emotional emptiness.`
    ],
    example: { p: `What does the dinner table shot say about the family?`, s: `By sitting the family in a line facing us, Morita shows that they eat together but never face or speak to each other. The family is a performance, and the tutor's violence finally exposes it.` },
    pitfalls: [`Watching only for plot; the film's satire is in its framing and sound.`, `Forgetting that the target is exam culture and the middle-class family.`],
    tip: `Note two shots or sounds to cite; film essays need visual evidence.` }, R('Watch: The Family Game')),

  Object.assign({ id: 'kitchen', label: '5.3', title: 'Banana’s world: Kitchen and consumer Japan', unit: 5,
    ideas: [
      `<b>Kitchen</b> (1988) by <b>Yoshimoto Banana</b> (born 1964) was a huge bestseller ("Banana mania") in the bubble years.`,
      `Mikage, orphaned after her grandmother dies, finds comfort only in <b>kitchens</b>. She moves in with Yūichi Tanabe and his mother Eriko, a transgender woman who was once Yūichi's father, and finds a chosen family.`,
      `After Eriko is murdered, Mikage and Yūichi's grief brings them closer; in a famous scene she brings him a bowl of katsudon across the night.`,
      `Its style is light, simple and girlish (shōjo), yet it deals with death, loneliness and non-traditional families.`,
      `<b>Tanaka Yasuo</b>'s <b>Somehow, Crystal</b> (1980) follows a Tokyo college student among brand names, explained in hundreds of notes: the consumer culture of the 1980s <b>bubble economy</b>, which burst around 1990.`
    ],
    example: { p: `Why are kitchens central in Kitchen?`, s: `Kitchens are warm, practical places where food is made and shared. For the grieving Mikage they stand for comfort and new family ties, which matters in a world where blood family has died and Eriko's family is chosen, not given.` },
    pitfalls: [`Dismissing the book as light because of its style; it is about grief.`, `Mixing up Yoshimoto Banana (Kitchen) and Yoshimoto the tutor in The Family Game.`],
    tip: `Banana: chosen family, food and grief. Tanaka: brands and the bubble.` }, R('Reading: Craig pp. 159–172; Kitchen; Tanaka (Canvas)')),

  Object.assign({ id: 'anime', label: '5.4', title: 'Anime: Akira and Ghost in the Shell', unit: 5,
    ideas: [
      `Susan <b>Napier</b>'s "Why Anime?" argues that anime deserves serious study: it reaches global audiences and explores identity, the body, technology and apocalypse.`,
      `<b>Akira</b> (1988), directed by <b>Ōtomo Katsuhiro</b> from his own manga, is set in Neo-Tokyo in 2019, rebuilt after a blast destroyed Tokyo. Biker gang members Kaneda and <b>Tetsuo</b> collide with military psychic experiments; Tetsuo's powers mutate his body and erupt in a catastrophic explosion.`,
      `The <b>"nuclear sublime"</b>: Akira replays the atomic destruction of 1945 as awe-inspiring spectacle, at once horror and fascination with total destruction and rebirth.`,
      `<b>Ghost in the Shell</b> (1995), directed by <b>Oshii Mamoru</b>, follows the cyborg agent <b>Major Kusanagi</b>, whose body (the shell) is entirely artificial. She hunts the Puppet Master, an artificial intelligence, and finally merges with it.`,
      `Both ask <b>posthuman</b> questions: what is the self (the "ghost") when the body can be rebuilt, mutated or networked?`
    ],
    example: { p: `Compare the bodies in Akira and Ghost in the Shell.`, s: `In Akira, Tetsuo's body swells out of control, a monstrous, organic transformation tied to nuclear trauma. In Ghost in the Shell, Kusanagi's body is a manufactured shell and the question is whether her mind is her own. Both use the body to ask what being human means after technology.` },
    pitfalls: [`Treating anime as children's entertainment; these are adult films.`, `Mixing up the directors: Ōtomo (Akira) and Oshii (Ghost in the Shell).`],
    tip: `Learn the term "nuclear sublime" and one scene that shows it.` }, R('Reading: Napier; Brown (Canvas); watch Akira and Ghost in the Shell')),

  Object.assign({ id: 'thief', label: '5.5', title: 'Post-bubble blues: Nakamura Fuminori’s The Thief', unit: 5,
    ideas: [
      `The <b>bubble economy</b> of the late 1980s burst around 1990, followed by the <b>"lost decade(s)"</b> of stagnation, insecure jobs and anxiety. 1995 brought the Kobe earthquake and the Aum Shinrikyō sarin attack on the Tokyo subway.`,
      `<b>Nakamura Fuminori</b> (born 1977) writes dark, literary crime fiction. <b>The Thief</b> (2009; English 2012) won the Ōe Kenzaburō Prize.`,
      `The narrator, Nishimura, is a skilled, solitary <b>pickpocket</b> in Tokyo who steals almost by reflex. He is drawn back into a job by <b>Kizaki</b>, a crime boss who controls other people's lives like a god.`,
      `He also protects a boy whose mother makes him shoplift, a small act of care in a cold city.`,
      `Themes: fate and control, isolation in the city, and life on the margins of post-bubble Japan.`
    ],
    example: { p: `What does Kizaki represent?`, s: `Total control: he plans other people's lives and deaths and claims to decide fate. Against him, Nishimura's skill and his small kindness to the boy are his only freedom, a bleak picture of individuals in post-bubble Japan.` },
    pitfalls: [`Reading it only as a thriller; it is a novel about fate and alienation.`, `Mixing up the bubble (late 1980s boom) and the post-bubble slump (1990s on).`],
    tip: `Set The Thief against Kitchen: both lonely young people in Tokyo, one warm, one bleak.` }, R('Reading: Nakamura, The Thief')),

  Object.assign({ id: 'murata', label: '5.6', title: 'Murata Sayaka’s “Eating the City” and wrap-up', unit: 5,
    ideas: [
      `<b>Murata Sayaka</b> (born 1979) is best known for <b>Convenience Store Woman</b> (2016, Akutagawa Prize). Her fiction questions what society counts as normal.`,
      `In <b>"Eating the City"</b>, a young woman who grew up in the countryside starts gathering and eating the wild plants that grow in Tokyo, unsettling the line between nature and city and between food and "weeds".`,
      `The story asks what counts as food and as normal behavior, and what city life cuts us off from.`,
      `<b>Course wrap-up:</b> trace the threads from the Kojiki to today: impermanence and beauty, borrowing and adapting foreign culture, the individual against duty, and how Japan remembers its past.`,
      `The final's two essay questions are given out ahead of time; plan each around these threads with evidence from readings across the term.`
    ],
    example: { p: `How might "Eating the City" connect to earlier readings?`, s: `Like Chōmei's hut or Kenkō's idleness, it imagines stepping outside ordinary society to see it freshly. Like Kitchen, it uses food to ask what we need to live and belong.` },
    pitfalls: [`Treating "Eating the City" as a realistic survival story; it is playful and strange on purpose.`, `Writing final essays only about the last unit when the question invites the whole course.`],
    tip: `For the final, prepare one example per unit for each big theme.` }, R('Reading: Murata, “Eating the City” (Canvas)'))
];

const T = (n, d) => ({ n, d });
const FORMULAS = [
  { group: 'Periods (timeline)', items: [T('Jōmon', 'c. 14,000–300 BCE. Hunter-gatherers; cord-marked pottery.'), T('Yayoi', 'c. 300 BCE–250 CE. Wet-rice farming, bronze and iron; Queen Himiko.'), T('Kofun', 'c. 250–538. Keyhole-shaped burial mounds; rise of the Yamato.'), T('Nara', '710–794. First permanent capital; Great Buddha of Tōdai-ji; the Kojiki (712).'), T('Heian', '794–1185. Court culture in Kyoto; Fujiwara regents; Genji and The Pillow Book.'), T('Kamakura', '1185–1333. First shogunate (Minamoto no Yoritomo); Mongol invasions.'), T('Muromachi', '1336–1573. Ashikaga shoguns; Noh, Zen arts; Ōnin War and Warring States.'), T('Tokugawa (Edo)', '1603–1868. Pax Tokugawa; closed country; the floating world.'), T('Meiji', '1868–1912. Restoration; modernization; empire.'), T('Taishō', '1912–1926. Taishō democracy, mass culture, modernism.'), T('Shōwa', '1926–1989. War, defeat, Occupation, economic miracle, bubble.'), T('Heisei', '1989–2019. Bubble bursts; the lost decades.')] },
  { group: 'Religion and aesthetics', items: [T('kami', 'The spirits or gods of Shinto: of places, nature, ancestors and the sun goddess.'), T('kegare / harae', 'Pollution (from death, blood) and the purification rites that remove it.'), T('mappō', 'The age of the decline of the Buddhist law; fed Pure Land faith.'), T('Pure Land', 'Faith in Amida Buddha; reciting his name (nenbutsu) for rebirth in his paradise.'), T('Zen', 'Buddhism of meditation and direct insight; Rinzai and Sōtō schools.'), T('mujō', 'Impermanence: everything passes.'), T('mono no aware', 'The pathos of things: sensitivity to beauty because it passes. Key to Genji.'), T('okashi', 'The delightful, witty, charming. Key to The Pillow Book.'), T('yūgen', 'Mysterious, profound grace. The ideal of Noh.'), T('wabi', 'Rustic simplicity and quiet poverty; tea aesthetics.'), T('sabi', 'The beauty of age, patina and loneliness; Bashō.'), T('giri / ninjō', 'Social duty versus human feeling; Chikamatsu’s conflict.'), T('ukiyo', 'The floating world: Edo pleasure quarters, kabuki and fashion.')] },
  { group: 'Literature and theater', items: [T('Kojiki', '712. Japan’s oldest book: myths and imperial genealogy.'), T('kana', 'Japanese phonetic script; Heian women wrote in it.'), T('monogatari', 'Tale or narrative, such as The Tale of Genji.'), T('zuihitsu', '“Following the brush”: a miscellany of essays and lists (The Pillow Book, Essays in Idleness).'), T('biwa hōshi', 'Blind lute-playing monks who chanted The Tales of the Heike.'), T('Noh', 'Masked, slow, chanted drama of Kan’ami and Zeami; shite, waki, chorus.'), T('shite / waki', 'Noh’s main actor (often a ghost) and secondary actor (often a priest).'), T('hashigakari', 'The bridgeway on the Noh stage by which actors enter.'), T('bunraku', 'Puppet theater: three puppeteers per puppet, a chanter (tayū) and shamisen.'), T('sewamono / jidaimono', 'Domestic plays about townspeople / history plays.'), T('shinjū', 'Love suicide; Chikamatsu’s The Love Suicides at Sonezaki.'), T('haiku (hokku)', '5-7-5 verse with a season word (kigo) and a cutting word (kireji).'), T('ukiyo-zōshi', 'Books of the floating world: Saikaku’s prose fiction.'), T('I-novel (shishōsetsu)', 'Confessional first-person fiction of the Taishō era.')] },
  { group: 'People', items: [T('Amaterasu', 'Sun goddess; ancestor of the imperial line.'), T('Prince Shōtoku', '574–622. Promoted Buddhism; Seventeen-Article Constitution.'), T('Murasaki Shikibu', 'Author of The Tale of Genji; served Empress Shōshi.'), T('Sei Shōnagon', 'Author of The Pillow Book; served Empress Teishi.'), T('Minamoto no Yoritomo', 'Founded the Kamakura shogunate.'), T('Kamo no Chōmei', 'Hōjōki (1212), the ten-foot square hut.'), T('Yoshida Kenkō', 'Essays in Idleness (about 1330).'), T('Zeami', '1363–1443. Noh playwright and theorist; Atsumori.'), T('Tokugawa Ieyasu', 'Won Sekigahara (1600); shogun 1603.'), T('Ihara Saikaku', '1642–1693. Prose of the townspeople’s love and money.'), T('Chikamatsu Monzaemon', '1653–1725. Bunraku and kabuki playwright.'), T('Matsuo Bashō', '1644–1694. Haiku master; The Narrow Road to the Deep North.'), T('Matthew Perry', 'US commodore whose black ships forced Japan open (1853–54).'), T('Natsume Sōseki', '1867–1916. And Then, Kokoro; critic of shallow modernization.'), T('Tanizaki Jun’ichirō', '1886–1965. In Praise of Shadows (1933).'), T('Douglas MacArthur', 'Led the Occupation (SCAP), 1945–51.')] },
  { group: 'Modern history', items: [T('Treaty of Kanagawa', '1854. Opened two ports to the US after Perry.'), T('unequal treaties', 'Extraterritoriality and fixed tariffs imposed by the Western powers from 1858.'), T('sonnō jōi', '“Revere the emperor, expel the barbarians”: the anti-shogunate slogan.'), T('Meiji Restoration', '1868. Power “restored” to the emperor; the start of rapid modernization.'), T('fukoku kyōhei', '“Rich country, strong army”.'), T('bunmei kaika', '“Civilization and enlightenment”: Westernization.'), T('Meiji Constitution', '1889. A Diet, with sovereignty kept by the emperor.'), T('Manchurian Incident', '1931. Japan seizes Manchuria.'), T('Pearl Harbor', 'December 7, 1941.'), T('Hiroshima / Nagasaki', 'Atomic bombings, August 6 and 9, 1945; surrender announced August 15.'), T('hibakusha', 'Survivors of the atomic bombings.'), T('Article 9', 'The postwar constitution’s renunciation of war (1947).'), T('San Francisco Treaty', 'Ended the Occupation, 1952.'), T('bubble economy', 'Late-1980s boom in stocks and land; burst around 1990.'), T('lost decade(s)', 'The long stagnation after the bubble burst.')] },
  { group: 'Modern works', items: [T('And Then (1909)', 'Sōseki. Daisuke, Michiyo, Hiraoka: love against family and society.'), T('“Lemon” (1925)', 'Kajii Motojirō. A lemon left as an imaginary bomb on a pile of art books.'), T('In Praise of Shadows (1933)', 'Tanizaki. Japanese beauty in shadow and dimness.'), T('Summer Flowers (1947)', 'Hara Tamiki. A survivor’s account of Hiroshima.'), T('Grave of the Fireflies (1988)', 'Takahata Isao, from Nosaka’s story. Seita and Setsuko starve after the firebombing of Kobe.'), T('“American Hijiki” (1967)', 'Nosaka Akiyuki. Toshio hosts an American couple; tea mistaken for seaweed.'), T('The Family Game (1983)', 'Morita Yoshimitsu. Exam hell and the family at a long table.'), T('Kitchen (1988)', 'Yoshimoto Banana. Mikage, Yūichi and Eriko: grief and chosen family.'), T('Somehow, Crystal (1980)', 'Tanaka Yasuo. Brands and the bubble, explained in notes.'), T('Akira (1988)', 'Ōtomo Katsuhiro. Neo-Tokyo, Tetsuo, the nuclear sublime.'), T('Ghost in the Shell (1995)', 'Oshii Mamoru. Major Kusanagi; the self in a cyborg body.'), T('The Thief (2009)', 'Nakamura Fuminori. A Tokyo pickpocket and the crime boss Kizaki.'), T('“Eating the City”', 'Murata Sayaka. Eating Tokyo’s wild plants.')] }
];

const fc = [];
const card = (unit, sec, f, b) => fc.push({ id: 'c-' + sec + '-' + (fc.filter(c => c.sec === sec).length + 1), unit, sec, f, b });
card(1, 'intro', 'What is the Kojiki?', 'Japan’s oldest book (712): creation myths and the genealogy of the imperial line.');
card(1, 'intro', 'Who are Izanagi and Izanami?', 'The creator couple who make the Japanese islands in the Kojiki.');
card(1, 'intro', 'Amaterasu', 'The sun goddess, who hid in a cave, and ancestor of the emperors.');
card(1, 'intro', 'Susanoo', 'The unruly storm god, Amaterasu’s brother.');
card(1, 'origins', 'Order the early periods', 'Jōmon, Yayoi, Kofun, Nara, Heian.');
card(1, 'origins', 'What did the Yayoi period bring?', 'Wet-rice farming, bronze and iron from the continent.');
card(1, 'origins', 'What are kofun?', 'Huge keyhole-shaped burial mounds of early rulers (c. 250–538).');
card(1, 'origins', 'Prince Shōtoku', 'Promoted Buddhism and issued the Seventeen-Article Constitution (604).');
card(1, 'origins', 'When was the court at Heian-kyō (Kyoto) founded?', '794, opening the Heian period.');
card(1, 'religions', 'What are kami?', 'The spirits or gods of Shinto, in nature, places and ancestors.');
card(1, 'religions', 'Which Shinto value stands out?', 'Purity: pollution (kegare) is removed by purification (harae).');
card(1, 'religions', 'What is mappō?', 'The age of the decline of the Buddhist law, which fed Pure Land faith.');
card(1, 'religions', 'Pure Land Buddhism', 'Faith in Amida Buddha; chant his name for rebirth in his paradise.');
card(1, 'genji', 'Who wrote The Tale of Genji?', 'Murasaki Shikibu, a lady-in-waiting at the Heian court, in the early 1000s.');
card(1, 'genji', 'What happens to Yūgao?', 'She dies mysteriously in a deserted villa, apparently killed by a spirit.');
card(1, 'genji', 'mono no aware', 'The pathos of things: beauty felt through its passing.');
card(1, 'genji', 'Why kana?', 'Heian women wrote in the Japanese phonetic script; men wrote official Chinese.');
card(1, 'pillow', 'Who wrote The Pillow Book?', 'Sei Shōnagon, lady-in-waiting to Empress Teishi.');
card(1, 'pillow', 'What is a zuihitsu?', '“Following the brush”: a miscellany of lists, sketches and opinions.');
card(1, 'pillow', 'okashi', 'The delightful and witty: the mood of The Pillow Book.');
card(2, 'samurai', 'The Genpei War', '1180–1185: the Minamoto (Genji) defeat the Taira (Heike).');
card(2, 'samurai', 'Who founded the first shogunate?', 'Minamoto no Yoritomo, at Kamakura (shogun 1192).');
card(2, 'samurai', 'What were the kamikaze?', 'The storms that helped wreck the Mongol invasions of 1274 and 1281.');
card(2, 'samurai', 'Which shoguns ruled in the Muromachi period?', 'The Ashikaga.');
card(2, 'heike', 'How was The Tales of the Heike performed?', 'Chanted to the lute by blind monks (biwa hōshi).');
card(2, 'heike', 'Main theme of the Heike', 'The impermanence of all things; the proud do not endure.');
card(2, 'heike', 'Who kills Atsumori?', 'Kumagai Naozane, who later becomes a monk.');
card(2, 'hojoki', 'Hōjōki', 'Kamo no Chōmei’s account of his ten-foot square hut (1212).');
card(2, 'hojoki', 'The Hōjōki’s opening image', 'A river: ceaseless flow, never the same water.');
card(2, 'hojoki', 'How does the Hōjōki end?', 'Chōmei wonders whether his love of the hut is itself an attachment.');
card(2, 'kenko', 'Essays in Idleness', 'Yoshida Kenkō’s miscellany (Tsurezuregusa, about 1330).');
card(2, 'kenko', 'Kenkō on cherry blossoms', 'Should we look at them only in full bloom? Beauty lies in the passing and the incomplete.');
card(2, 'noh', 'Who shaped Noh?', 'Kan’ami and his son Zeami, under the shogun Ashikaga Yoshimitsu.');
card(2, 'noh', 'yūgen', 'The mysterious, profound grace that is Noh’s ideal.');
card(2, 'noh', 'shite and waki', 'Noh’s main actor (often a ghost, masked) and secondary actor (often a priest).');
card(2, 'noh', 'What is painted on the Noh stage’s back wall?', 'A pine tree.');
card(2, 'noh', 'wabi and sabi', 'Rustic simplicity; the beauty of age and loneliness.');
card(3, 'tokugawa', 'The three unifiers', 'Oda Nobunaga, Toyotomi Hideyoshi, Tokugawa Ieyasu.');
card(3, 'tokugawa', 'Battle of Sekigahara', '1600: Tokugawa Ieyasu’s victory; shogun in 1603.');
card(3, 'tokugawa', 'Alternate attendance', 'Daimyo lived in Edo every other year, leaving their families there.');
card(3, 'tokugawa', 'sakoku', 'The “closed country” policy from the 1630s; Dutch and Chinese trade only at Nagasaki.');
card(3, 'saikaku', 'chōnin', 'Townspeople: merchants and artisans.');
card(3, 'saikaku', 'ukiyo in the Edo period', 'The floating world of pleasure quarters, kabuki and fashion.');
card(3, 'saikaku', 'The Eternal Storehouse of Japan', 'Saikaku’s stories of merchants making and losing fortunes (1688).');
card(3, 'chikamatsu', 'What is bunraku?', 'Puppet theater: three puppeteers per puppet, a chanter and shamisen.');
card(3, 'chikamatsu', 'The Love Suicides at Sonezaki', 'Chikamatsu, 1703: Tokubei and Ohatsu die together.');
card(3, 'chikamatsu', 'giri and ninjō', 'Social duty against human feeling.');
card(3, 'chikamatsu', 'sewamono', 'Domestic plays about townspeople.');
card(3, 'basho', 'A haiku’s two key features beyond 5-7-5', 'A season word (kigo) and a cutting word (kireji).');
card(3, 'basho', 'Bashō’s most famous haiku', 'Old pond, a frog jumps in, the sound of water.');
card(3, 'basho', 'The Narrow Road to the Deep North', 'Bashō’s travel diary of prose and haiku, from his 1689 journey.');
card(3, 'bakumatsu', 'When did Perry arrive?', '1853, returning in 1854 for the Treaty of Kanagawa.');
card(3, 'bakumatsu', 'sonnō jōi', '“Revere the emperor, expel the barbarians.”');
card(3, 'bakumatsu', 'Which domains led the fight against the Tokugawa?', 'Satsuma and Chōshū.');
card(3, 'bakumatsu', 'unequal treaties', 'Gave Westerners extraterritoriality and fixed Japan’s tariffs.');
card(4, 'meiji', 'Meiji Restoration', '1868: power restored to the emperor; capital moved to Tokyo.');
card(4, 'meiji', 'fukoku kyōhei', '“Rich country, strong army.”');
card(4, 'meiji', 'Meiji Constitution', '1889: a Diet, with sovereignty kept by the emperor.');
card(4, 'meiji', 'Japan’s Meiji wars', 'Against China (1894–95) and Russia (1904–05).');
card(4, 'soseki', 'And Then', 'Sōseki (1909): Daisuke chooses Michiyo, his friend Hiraoka’s wife, and loses his family’s support.');
card(4, 'soseki', 'Sōseki’s view of modernization', 'Forced from outside and superficial, leaving people anxious.');
card(4, 'taisho', 'Taishō democracy', 'Party politics and universal male suffrage (1925).');
card(4, 'taisho', '“Lemon”', 'Kajii Motojirō (1925): a lemon left on art books as an imaginary bomb.');
card(4, 'tanizaki', 'In Praise of Shadows', 'Tanizaki (1933): Japanese beauty lies in shadow and dimness.');
card(4, 'tanizaki', 'Tanizaki’s example of lacquerware', 'It glows only in candlelight and dim rooms.');
card(4, 'ww2', 'Manchurian Incident', '1931: Japan seizes Manchuria.');
card(4, 'ww2', 'Nanjing Massacre', '1937–38: Japanese troops kill many thousands of civilians and prisoners.');
card(4, 'ww2', 'When did Japan announce its surrender?', 'August 15, 1945.');
card(4, 'hiroshima', 'Grave of the Fireflies', 'Takahata Isao (1988): Seita and Setsuko starve after the firebombing of Kobe.');
card(4, 'hiroshima', 'Summer Flowers', 'Hara Tamiki’s survivor account of Hiroshima (1947).');
card(4, 'hiroshima', 'hibakusha', 'Survivors of the atomic bombings.');
card(4, 'hiroshima', 'The Enola Gay controversy', '1995: a Smithsonian exhibit was cut back after veterans and politicians objected to how it presented the bombing.');
card(4, 'occupation', 'Who led the Occupation?', 'General Douglas MacArthur (SCAP).');
card(4, 'occupation', 'Article 9', 'The 1947 constitution’s renunciation of war.');
card(4, 'occupation', 'When did the Occupation end?', '1952, with the San Francisco Treaty.');
card(5, 'hijiki', 'What is the “American hijiki”?', 'Black tea from American aid, mistaken for hijiki seaweed and cooked.');
card(5, 'hijiki', 'Who wrote “American Hijiki”?', 'Nosaka Akiyuki, also author of “A Grave of Fireflies”.');
card(5, 'familygame', 'The Family Game', 'Morita Yoshimitsu (1983): a tutor, exam hell, and a family eating in a row.');
card(5, 'familygame', 'juken jigoku', '“Exam hell”: the pressure of entrance exams.');
card(5, 'kitchen', 'Kitchen', 'Yoshimoto Banana (1988): Mikage finds comfort in kitchens and a chosen family.');
card(5, 'kitchen', 'Who is Eriko in Kitchen?', 'Yūichi’s mother, a transgender woman who was once his father.');
card(5, 'kitchen', 'Somehow, Crystal', 'Tanaka Yasuo (1980): bubble-era consumer life told through brand names.');
card(5, 'anime', 'Who directed Akira?', 'Ōtomo Katsuhiro (1988).');
card(5, 'anime', 'Who directed Ghost in the Shell?', 'Oshii Mamoru (1995).');
card(5, 'anime', 'The nuclear sublime', 'Atomic destruction shown as awe-inspiring spectacle, as in Akira.');
card(5, 'anime', 'Major Kusanagi', 'The cyborg agent of Ghost in the Shell, whose body is fully artificial.');
card(5, 'thief', 'The Thief', 'Nakamura Fuminori (2009): Nishimura, a pickpocket, and the crime boss Kizaki.');
card(5, 'thief', 'The lost decade', 'The stagnation after the bubble burst around 1990.');
card(5, 'murata', 'Murata Sayaka’s best-known novel', 'Convenience Store Woman (2016).');
card(5, 'murata', '“Eating the City”', 'A young woman gathers and eats Tokyo’s wild plants.');

const P = (n, sec, q, s) => ({ n, sec, tags: ['essay practice'], q, s });
const PRACTICE = {
  exam1: { title: 'Exam 1 essay practice', subtitle: 'Mathub’s own practice prompts, not the professor’s question. Plan three points, each tied to a reading, in about 15 minutes.', problems: [
    P(1, 'intro', 'What do the Kojiki myths tell us about early Japanese values?', 'Divine descent of the emperors from Amaterasu (political legitimacy); purity and pollution (Izanagi’s purification after Yomi); kami in nature. Use the Izanagi–Izanami and Amaterasu cave episodes.'),
    P(2, 'genji', 'Explain mono no aware using “Yūgao”.', 'Define it as sensitivity to beauty in its passing. Yūgao, named for a flower that fades by morning; her sudden death; Genji’s grief and memory. Beauty heightened by loss.'),
    P(3, 'pillow', 'Compare The Tale of Genji and The Pillow Book.', 'Form: long tale vs miscellany (zuihitsu). Mood: aware vs okashi. Shared world: court refinement, seasons, poetry. The two authors’ rivalry, from Murasaki’s diary.'),
    P(4, 'religions', 'How did Buddhism change Heian culture?', 'Impermanence and karma enter literature; Tendai and Shingon; mappō and Pure Land faith; blending with Shinto (kami as forms of buddhas).'),
    P(5, 'origins', 'Trace how Japan borrowed from China and Korea before 800.', 'Rice and metals (Yayoi), writing, Buddhism (6th century), Prince Shōtoku’s constitution, the Taika Reforms, the Chinese-style capitals at Nara and Heian; but adapted, without exams for officials.')
  ] },
  exam2: { title: 'Exam 2 essay practice', subtitle: 'Practice prompts on the samurai age and the Tokugawa peace. Use quotations and named works.', problems: [
    P(1, 'heike', 'How does The Tales of the Heike turn warfare into literature?', 'The opening on impermanence; Kiyomori’s pride and the Taira’s fall; the death of Atsumori and Kumagai’s turn to Buddhism. War told as Buddhist lament rather than glory.'),
    P(2, 'hojoki', 'Compare Chōmei and Kenkō as recluses.', 'Chōmei: disasters, the river, the tiny hut, doubt at the end. Kenkō: a worldly ascetic who loves taste and anecdote; beauty in impermanence and the incomplete. One flees, one watches.'),
    P(3, 'noh', 'How does the Noh Atsumori rework the Heike episode?', 'The ghost returns as shite; Kumagai is now the priest Rensei (waki); the battle is relived in dance; forgiveness and shared rebirth; yūgen.'),
    P(4, 'chikamatsu', 'Explain giri and ninjō in Chikamatsu and Saikaku.', 'Sonezaki: Tokubei’s honor and debts vs his love for Ohatsu; double suicide. Saikaku’s almanac maker: an accidental affair and execution. The chōnin world of money and passion.'),
    P(5, 'basho', 'What makes Bashō’s haiku more than 5-7-5?', 'Season word, cutting word, two images; the old pond haiku; sabi and karumi; travel diaries mixing prose and verse.'),
    P(6, 'bakumatsu', 'Why did the Tokugawa shogunate fall?', 'Perry and the unequal treaties exposed its weakness; sonnō jōi; Satsuma and Chōshū; the 1868 Restoration.')
  ] },
  exam3: { title: 'Exam 3 essay practice', subtitle: 'Practice prompts on modern Japan from Meiji to the Occupation.', problems: [
    P(1, 'soseki', 'What does And Then say about modern individuals?', 'Daisuke’s idleness as critique of work; his choice of Michiyo over family duty; disinheritance; Sōseki’s view of shallow modernization; the red city at the end.'),
    P(2, 'tanizaki', 'Is In Praise of Shadows reactionary aesthetics?', 'Yes: nostalgia, Japan against West in the 1930s. But also irony, self-awareness and real insight (lacquerware, the toilet, dim rooms). Conclude with a judgment.'),
    P(3, 'taisho', 'How does “Lemon” capture Taishō modernism?', 'Urban gloom; sensory escape in the lemon; the Maruzen bookstore and imported culture; the imaginary bomb as private rebellion.'),
    P(4, 'ww2', 'Victimizers or victims? How do the war readings answer?', 'Aggression in China (Hirabayashi, Kojima); suffering at home (Grave of the Fireflies, Summer Flowers); memory politics (the Enola Gay controversy). Argue for complexity.'),
    P(5, 'occupation', 'What did the Occupation change, and what did it keep?', 'Constitution, Article 9, women’s suffrage, land reform; the emperor kept as a symbol; the reverse course; the end in 1952.')
  ] },
  final: { title: 'Final exam essay practice', subtitle: 'Practice prompts on postwar Japan and on themes across the whole course. The final has two essay questions, given out ahead of time.', problems: [
    P(1, 'hijiki', 'How do Nosaka and Morita portray postwar Japan’s anxieties?', '“American Hijiki”: memories of hunger and dependence, Toshio’s servility and resentment. The Family Game: exam hell, the family in a row, comfort without connection.'),
    P(2, 'kitchen', 'How does Kitchen rethink the family?', 'Mikage’s losses; Eriko and Yūichi’s chosen family; food and kitchens as comfort; the bubble-era setting compared with Somehow, Crystal.'),
    P(3, 'anime', 'What do Akira and Ghost in the Shell ask about being human?', 'Tetsuo’s mutating body and the nuclear sublime; Kusanagi’s artificial shell and the ghost within; Napier on why anime matters.'),
    P(4, 'thief', 'How does The Thief reflect post-bubble Japan?', 'Isolation, insecure lives, Kizaki’s control as fate, Nishimura’s small kindness to the boy; compare with Kitchen.'),
    P(5, 'murata', 'Trace one theme from the Kojiki to “Eating the City”.', 'Options: impermanence (Genji, Heike, Kenkō, Tanizaki); borrowing and adapting (Nara, Meiji, Occupation, anime); individual vs duty (Chikamatsu, Sōseki, Kitchen). Give one example per era.')
  ] }
};

const CHECKLISTS = {
  exam1: ['I can put Jōmon, Yayoi, Kofun, Nara and Heian in order with one fact each.', 'I can retell the Kojiki’s Izanagi, Izanami and Amaterasu myths.', 'I can explain Shinto purity, Buddhist impermanence, mappō and Pure Land.', 'I can summarize “Yūgao” and explain mono no aware.', 'I can describe The Pillow Book’s form and contrast okashi with aware.', 'I have planned my answer to the essay question with three supported points.'],
  exam2: ['I can explain the rise of the samurai, the Genpei War and the Kamakura and Ashikaga shogunates.', 'I can explain the Heike’s theme of impermanence and the death of Atsumori.', 'I can compare Chōmei’s Hōjōki and Kenkō’s Essays in Idleness.', 'I can describe the Noh stage, shite and waki, yūgen and the play Atsumori.', 'I can explain the Tokugawa system: the unifiers, alternate attendance, the status order and sakoku.', 'I can explain Saikaku’s chōnin world, Chikamatsu’s giri and ninjō, and Bashō’s haiku.', 'I can explain the Bakumatsu: Perry, the unequal treaties, sonnō jōi and Satsuma–Chōshū.'],
  exam3: ['I can explain the Meiji reforms and slogans.', 'I can summarize And Then and Sōseki’s view of modernization.', 'I can explain Taishō modernism and Kajii’s “Lemon”.', 'I can explain In Praise of Shadows and argue whether it is reactionary.', 'I can outline Japan’s war from 1931 to 1945 and the victimizer/victim debate.', 'I can discuss Grave of the Fireflies, Summer Flowers and the Enola Gay controversy.', 'I can explain the Occupation’s reforms, Article 9 and the end of the Occupation.'],
  final: ['I can summarize “American Hijiki” and what the title means.', 'I can describe The Family Game’s satire and its dinner-table image.', 'I can explain Kitchen’s chosen family and the bubble economy behind it.', 'I can compare Akira and Ghost in the Shell and explain the nuclear sublime.', 'I can explain The Thief against the post-bubble background.', 'I can describe “Eating the City” and connect it to earlier readings.', 'I have one example per unit for each big theme of the course.']
};

module.exports = { SECTIONS, FORMULAS, FLASHCARDS: fc, PRACTICE, CHECKLISTS };
