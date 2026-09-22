
const cambridge = (word) =>
  `https://dictionary.cambridge.org/pronunciation/english/${word.toLowerCase().replaceAll(" ", "-")}`;

const WORD_BANK = [
  // Easy
  { word: "I", ipa: "/aɪ/", usIpa: "/aɪ/", syllables: ["I"], stress: 1, level: "easy", source: cambridge("I") },
  { word: "have", ipa: "/hæv/", usIpa: "/hæv/", weakUk: "/həv/", weakUs: "/həv/", syllables: ["have"], stress: 1, level: "easy", source: cambridge("have") },
  { word: "a", ipa: "/eɪ/", usIpa: "/eɪ/", weakUk: "/ə/", weakUs: "/ə/", syllables: ["a"], stress: 1, level: "easy", source: cambridge("a") },
  { word: "dog", ipa: "/dɒɡ/", usIpa: "/dɑːɡ/", syllables: ["dog"], stress: 1, level: "easy", source: cambridge("dog") },
  { word: "love", ipa: "/lʌv/", usIpa: "/lʌv/", syllables: ["love"], stress: 1, level: "easy", source: cambridge("love") },
  { word: "you", ipa: "/juː/", usIpa: "/juː/", weakUk: "/jə/", weakUs: "/jə/", syllables: ["you"], stress: 1, level: "easy", source: cambridge("you") },
  { word: "we", ipa: "/wiː/", usIpa: "/wiː/", syllables: ["we"], stress: 1, level: "easy", source: cambridge("we") },
  { word: "they", ipa: "/ðeɪ/", usIpa: "/ðeɪ/", syllables: ["they"], stress: 1, level: "easy", source: cambridge("they") },
  { word: "my", ipa: "/maɪ/", usIpa: "/maɪ/", syllables: ["my"], stress: 1, level: "easy", source: cambridge("my") },
  { word: "name", ipa: "/neɪm/", usIpa: "/neɪm/", syllables: ["name"], stress: 1, level: "easy", source: cambridge("name") },
  { word: "is", ipa: "/ɪz/", usIpa: "/ɪz/", weakUk: "/z/", weakUs: "/z/", syllables: ["is"], stress: 1, level: "easy", source: cambridge("is") },
  { word: "the", ipa: "/ðiː/", usIpa: "/ðiː/", weakUk: "/ðə/", weakUs: "/ðə/", syllables: ["the"], stress: 1, level: "easy", source: cambridge("the") },
  { word: "and", ipa: "/ænd/", usIpa: "/ænd/", weakUk: "/ənd/", weakUs: "/ənd/", syllables: ["and"], stress: 1, level: "easy", source: cambridge("and") },
  { word: "to", ipa: "/tuː/", usIpa: "/tuː/", weakUk: "/tə/", weakUs: "/tə/", syllables: ["to"], stress: 1, level: "easy", source: cambridge("to") },
  { word: "of", ipa: "/ɒv/", usIpa: "/əv/", weakUk: "/əv/", weakUs: "/əv/", syllables: ["of"], stress: 1, level: "easy", source: cambridge("of") },
  { word: "for", ipa: "/fɔː/", usIpa: "/fɔːr/", weakUk: "/fə/", weakUs: "/fɚ/", syllables: ["for"], stress: 1, level: "easy", source: cambridge("for") },
  { word: "in", ipa: "/ɪn/", usIpa: "/ɪn/", syllables: ["in"], stress: 1, level: "easy", source: cambridge("in") },
  { word: "on", ipa: "/ɒn/", usIpa: "/ɑːn/", syllables: ["on"], stress: 1, level: "easy", source: cambridge("on") },
  { word: "it", ipa: "/ɪt/", usIpa: "/ɪt/", syllables: ["it"], stress: 1, level: "easy", source: cambridge("it") },
  { word: "this", ipa: "/ðɪs/", usIpa: "/ðɪs/", syllables: ["this"], stress: 1, level: "easy", source: cambridge("this") },
  { word: "that", ipa: "/ðæt/", usIpa: "/ðæt/", syllables: ["that"], stress: 1, level: "easy", source: cambridge("that") },
  { word: "sad", ipa: "/sæd/", syllables: ["sad"], stress: 1, level: "easy", source: cambridge("sad") },
  { word: "text", ipa: "/tekst/", syllables: ["text"], stress: 1, level: "easy", source: cambridge("text") },
  { word: "call", ipa: "/kɔːl/", syllables: ["call"], stress: 1, level: "easy", source: cambridge("call") },
  { word: "speak", ipa: "/spiːk/", syllables: ["speak"], stress: 1, level: "easy", source: cambridge("speak") },
  { word: "school", ipa: "/skuːl/", syllables: ["school"], stress: 1, level: "easy", source: cambridge("school") },
  { word: "sheet", ipa: "/ʃiːt/", syllables: ["sheet"], stress: 1, level: "easy", source: cambridge("sheet") },
  { word: "make", ipa: "/meɪk/", syllables: ["make"], stress: 1, level: "easy", source: cambridge("make") },
  { word: "graph", ipa: "/ɡrɑːf/", syllables: ["graph"], stress: 1, level: "easy", source: cambridge("graph") },
  { word: "shirt", ipa: "/ʃɜːt/", syllables: ["shirt"], stress: 1, level: "easy", source: cambridge("shirt") },
  { word: "blood", ipa: "/blʌd/", syllables: ["blood"], stress: 1, level: "easy", source: cambridge("blood") },
  { word: "touch", ipa: "/tʌtʃ/", syllables: ["touch"], stress: 1, level: "easy", source: cambridge("touch") },
  { word: "new", ipa: "/njuː/", syllables: ["new"], stress: 1, level: "easy", source: cambridge("new") },
  { word: "fight", ipa: "/faɪt/", syllables: ["fight"], stress: 1, level: "easy", source: cambridge("fight") },
  { word: "stay", ipa: "/steɪ/", syllables: ["stay"], stress: 1, level: "easy", source: cambridge("stay") },
  { word: "brown", ipa: "/braʊn/", syllables: ["brown"], stress: 1, level: "easy", source: cambridge("brown") },
  { word: "gas", ipa: "/ɡæs/", syllables: ["gas"], stress: 1, level: "easy", source: cambridge("gas") },
  { word: "quick", ipa: "/kwɪk/", syllables: ["quick"], stress: 1, level: "easy", source: cambridge("quick") },
  { word: "ripe", ipa: "/raɪp/", syllables: ["ripe"], stress: 1, level: "easy", source: cambridge("ripe") },
  { word: "fun", ipa: "/fʌn/", syllables: ["fun"], stress: 1, level: "easy", source: cambridge("fun") },
  { word: "soon", ipa: "/suːn/", syllables: ["soon"], stress: 1, level: "easy", source: cambridge("soon") },
  { word: "ship", ipa: "/ʃɪp/", syllables: ["ship"], stress: 1, level: "easy", source: cambridge("ship") },
  { word: "home", ipa: "/həʊm/", syllables: ["home"], stress: 1, level: "easy", source: cambridge("home") },
  { word: "zoo", ipa: "/zuː/", syllables: ["zoo"], stress: 1, level: "easy", source: cambridge("zoo") },
  { word: "mail", ipa: "/meɪl/", syllables: ["mail"], stress: 1, level: "easy", source: cambridge("mail") },
  { word: "red", ipa: "/red/", ipaAlt: ["/rɛd/"], syllables: ["red"], stress: 1, level: "easy", source: cambridge("red") },
  { word: "know", ipa: "/nəʊ/", syllables: ["know"], stress: 1, level: "easy", source: cambridge("know") },
  { word: "drive", ipa: "/draɪv/", syllables: ["drive"], stress: 1, level: "easy", source: cambridge("drive") },
  { word: "split", ipa: "/splɪt/", syllables: ["split"], stress: 1, level: "easy", source: cambridge("split") },
  { word: "tank", ipa: "/tæŋk/", syllables: ["tank"], stress: 1, level: "easy", source: cambridge("tank") },
  { word: "kind", ipa: "/kaɪnd/", syllables: ["kind"], stress: 1, level: "easy", source: cambridge("kind") },

  // Medium
  { word: "paper", ipa: "/ˈpeɪ.pə/", syllables: ["pa", "per"], stress: 1, level: "medium", source: cambridge("paper") },
  { word: "wicked", ipa: "/ˈwɪk.ɪd/", syllables: ["wick", "ed"], stress: 1, level: "medium", source: cambridge("wicked") },
  { word: "admit", ipa: "/ədˈmɪt/", syllables: ["ad", "mit"], stress: 2, level: "medium", source: cambridge("admit") },
  { word: "focus", ipa: "/ˈfəʊ.kəs/", syllables: ["fo", "cus"], stress: 1, level: "medium", source: cambridge("focus") },
  { word: "idea", ipa: "/aɪˈdɪə/", syllables: ["i", "dea"], stress: 2, level: "medium", source: cambridge("idea") },
  { word: "behave", ipa: "/bɪˈheɪv/", syllables: ["be", "have"], stress: 2, level: "medium", source: cambridge("behave") },
  { word: "police", ipa: "/pəˈliːs/", syllables: ["po", "lice"], stress: 2, level: "medium", source: cambridge("police") },
  { word: "pleasure", ipa: "/ˈpleʒ.ə/", ipaAlt: ["/ˈplɛʒ.ə/"], syllables: ["plea", "sure"], stress: 1, level: "medium", source: cambridge("pleasure") },
  { word: "father", ipa: "/ˈfɑː.ðə/", syllables: ["fa", "ther"], stress: 1, level: "medium", source: cambridge("father") },
  { word: "teacher", ipa: "/ˈtiː.tʃə/", syllables: ["teach", "er"], stress: 1, level: "medium", source: cambridge("teacher") },
  { word: "photo", ipa: "/ˈfəʊ.təʊ/", syllables: ["pho", "to"], stress: 1, level: "medium", source: cambridge("photo") },
  { word: "control", ipa: "/kənˈtrəʊl/", syllables: ["con", "trol"], stress: 2, level: "medium", source: cambridge("control") },
  { word: "answer", ipa: "/ˈɑːn.sə/", syllables: ["an", "swer"], stress: 1, level: "medium", source: cambridge("answer") },
  { word: "garden", ipa: "/ˈɡɑː.dən/", syllables: ["gar", "den"], stress: 1, level: "medium", source: cambridge("garden") },
  { word: "cassette", ipa: "/kəˈset/", ipaAlt: ["/kəˈsɛt/"], syllables: ["cas", "sette"], stress: 2, level: "medium", source: cambridge("cassette") },
  { word: "address", ipa: "/əˈdres/", ipaAlt: ["/əˈdrɛs/"], syllables: ["ad", "dress"], stress: 2, level: "medium", source: cambridge("address") },
  { word: "party", ipa: "/ˈpɑː.ti/", syllables: ["par", "ty"], stress: 1, level: "medium", source: cambridge("party") },
  { word: "music", ipa: "/ˈmjuː.zɪk/", syllables: ["mu", "sic"], stress: 1, level: "medium", source: cambridge("music") },
  { word: "doctor", ipa: "/ˈdɒk.tə/", syllables: ["doc", "tor"], stress: 1, level: "medium", source: cambridge("doctor") },
  { word: "winter", ipa: "/ˈwɪn.tə/", syllables: ["win", "ter"], stress: 1, level: "medium", source: cambridge("winter") },
  { word: "brother", ipa: "/ˈbrʌð.ə/", syllables: ["broth", "er"], stress: 1, level: "medium", source: cambridge("brother") },
  { word: "dinner", ipa: "/ˈdɪn.ə/", syllables: ["din", "ner"], stress: 1, level: "medium", source: cambridge("dinner") },
  { word: "river", ipa: "/ˈrɪv.ə/", syllables: ["riv", "er"], stress: 1, level: "medium", source: cambridge("river") },
  { word: "pencil", ipa: "/ˈpen.səl/", ipaAlt: ["/ˈpɛn.səl/"], syllables: ["pen", "cil"], stress: 1, level: "medium", source: cambridge("pencil") },
  { word: "giraffe", ipa: "/dʒɪˈrɑːf/", syllables: ["gi", "raffe"], stress: 2, level: "medium", source: cambridge("giraffe") },
  { word: "parade", ipa: "/pəˈreɪd/", syllables: ["pa", "rade"], stress: 2, level: "medium", source: cambridge("parade") },
  { word: "antique", ipa: "/ænˈtiːk/", syllables: ["an", "tique"], stress: 2, level: "medium", source: cambridge("antique") },
  { word: "create", ipa: "/kriˈeɪt/", syllables: ["cre", "ate"], stress: 2, level: "medium", source: cambridge("create") },
  { word: "native", ipa: "/ˈneɪ.tɪv/", syllables: ["na", "tive"], stress: 1, level: "medium", source: cambridge("native") },
  { word: "balloon", ipa: "/bəˈluːn/", syllables: ["bal", "loon"], stress: 2, level: "medium", source: cambridge("balloon") },
  { word: "shampoo", ipa: "/ʃæmˈpuː/", syllables: ["sham", "poo"], stress: 2, level: "medium", source: cambridge("shampoo") },
  { word: "taboo", ipa: "/təˈbuː/", syllables: ["ta", "boo"], stress: 2, level: "medium", source: cambridge("taboo") },
  { word: "angry", ipa: "/ˈæŋ.ɡri/", syllables: ["an", "gry"], stress: 1, level: "medium", source: cambridge("angry") },
  { word: "central", ipa: "/ˈsen.trəl/", ipaAlt: ["/ˈsɛn.trəl/"], syllables: ["cen", "tral"], stress: 1, level: "medium", source: cambridge("central") },
  { word: "complete", ipa: "/kəmˈpliːt/", syllables: ["com", "plete"], stress: 2, level: "medium", source: cambridge("complete") },
  { word: "intense", ipa: "/ɪnˈtens/", syllables: ["in", "tense"], stress: 2, level: "medium", source: cambridge("intense") },
  { word: "precise", ipa: "/prɪˈsaɪs/", syllables: ["pre", "cise"], stress: 2, level: "medium", source: cambridge("precise") },
  { word: "object", ipa: "/ˈɒb.dʒekt/", ipaAlt: ["/əbˈdʒekt/"], syllables: ["ob", "ject"], stress: 1, level: "medium", avoidStress: true, source: cambridge("object") },
  { word: "locate", ipa: "/ləʊˈkeɪt/", syllables: ["lo", "cate"], stress: 2, level: "medium", source: cambridge("locate") },
  { word: "argue", ipa: "/ˈɑːɡ.juː/", syllables: ["ar", "gue"], stress: 1, level: "medium", source: cambridge("argue") },
  { word: "enter", ipa: "/ˈen.tə/", ipaAlt: ["/ˈɛn.tə/"], syllables: ["en", "ter"], stress: 1, level: "medium", source: cambridge("enter") },

  // Hard
  { word: "knowledge", ipa: "/ˈnɒl.ɪdʒ/", syllables: ["know", "ledge"], stress: 1, level: "hard", source: cambridge("knowledge") },
  { word: "beautiful", ipa: "/ˈbjuː.tɪ.fəl/", syllables: ["beau", "ti", "ful"], stress: 1, level: "hard", source: cambridge("beautiful") },
  { word: "cinema", ipa: "/ˈsɪn.ə.mə/", syllables: ["ci", "ne", "ma"], stress: 1, level: "hard", source: cambridge("cinema") },
  { word: "holiday", ipa: "/ˈhɒl.ə.deɪ/", syllables: ["hol", "i", "day"], stress: 1, level: "hard", source: cambridge("holiday") },
  { word: "family", ipa: "/ˈfæm.əl.i/", syllables: ["fam", "i", "ly"], stress: 1, level: "hard", source: cambridge("family") },
  { word: "energy", ipa: "/ˈen.ə.dʒi/", ipaAlt: ["/ˈɛn.ə.dʒi/"], syllables: ["en", "er", "gy"], stress: 1, level: "hard", source: cambridge("energy") },
  { word: "harmony", ipa: "/ˈhɑː.mə.ni/", syllables: ["har", "mo", "ny"], stress: 1, level: "hard", source: cambridge("harmony") },
  { word: "company", ipa: "/ˈkʌm.pə.ni/", syllables: ["com", "pa", "ny"], stress: 1, level: "hard", source: cambridge("company") },
  { word: "excellent", ipa: "/ˈek.səl.ənt/", ipaAlt: ["/ˈɛk.səl.ənt/"], syllables: ["ex", "cel", "lent"], stress: 1, level: "hard", source: cambridge("excellent") },
  { word: "consider", ipa: "/kənˈsɪd.ə/", syllables: ["con", "sid", "er"], stress: 2, level: "hard", source: cambridge("consider") },
  { word: "visitor", ipa: "/ˈvɪz.ɪ.tə/", syllables: ["vis", "i", "tor"], stress: 1, level: "hard", source: cambridge("visitor") },
  { word: "delicate", ipa: "/ˈdel.ɪ.kət/", ipaAlt: ["/ˈdɛl.ɪ.kət/"], syllables: ["del", "i", "cate"], stress: 1, level: "hard", source: cambridge("delicate") },
  { word: "terrible", ipa: "/ˈter.ə.bəl/", ipaAlt: ["/ˈtɛr.ə.bəl/"], syllables: ["ter", "ri", "ble"], stress: 1, level: "hard", source: cambridge("terrible") },
  { word: "adventure", ipa: "/ədˈven.tʃə/", ipaAlt: ["/ədˈvɛn.tʃə/"], syllables: ["ad", "ven", "ture"], stress: 2, level: "hard", source: cambridge("adventure") },
  { word: "remember", ipa: "/rɪˈmem.bə/", ipaAlt: ["/rɪˈmɛm.bə/"], syllables: ["re", "mem", "ber"], stress: 2, level: "hard", source: cambridge("remember") },
  { word: "delicious", ipa: "/dɪˈlɪʃ.əs/", syllables: ["de", "li", "cious"], stress: 2, level: "hard", source: cambridge("delicious") },
  { word: "important", ipa: "/ɪmˈpɔː.tənt/", syllables: ["im", "por", "tant"], stress: 2, level: "hard", source: cambridge("important") },
  { word: "banana", ipa: "/bəˈnɑː.nə/", syllables: ["ba", "na", "na"], stress: 2, level: "hard", source: cambridge("banana") },
  { word: "disaster", ipa: "/dɪˈzɑː.stə/", syllables: ["di", "sas", "ter"], stress: 2, level: "hard", source: cambridge("disaster") },
  { word: "celebrate", ipa: "/ˈsel.ə.breɪt/", ipaAlt: ["/ˈsɛl.ə.breɪt/"], syllables: ["cel", "e", "brate"], stress: 1, level: "hard", source: cambridge("celebrate") },
  { word: "phonetics", ipa: "/fəˈnet.ɪks/", ipaAlt: ["/fəˈnɛt.ɪks/"], syllables: ["pho", "net", "ics"], stress: 2, level: "hard", source: cambridge("phonetics") },
  { word: "animal", ipa: "/ˈæn.ɪ.məl/", syllables: ["an", "i", "mal"], stress: 1, level: "hard", source: cambridge("animal") },
  { word: "chocolate", ipa: "/ˈtʃɒk.lət/", syllables: ["choc", "late"], stress: 1, level: "hard", source: cambridge("chocolate") },
  { word: "medicine", ipa: "/ˈmed.ɪ.sən/", ipaAlt: ["/ˈmɛd.ɪ.sən/"], syllables: ["med", "i", "cine"], stress: 1, level: "hard", source: cambridge("medicine") },
  { word: "positive", ipa: "/ˈpɒz.ə.tɪv/", syllables: ["pos", "i", "tive"], stress: 1, level: "hard", source: cambridge("positive") },
  { word: "happiness", ipa: "/ˈhæp.i.nəs/", syllables: ["hap", "pi", "ness"], stress: 1, level: "hard", source: cambridge("happiness") },
  { word: "aquamarine", ipa: "/ˌæk.wə.məˈriːn/", syllables: ["a", "qua", "ma", "rine"], stress: 4, level: "hard", source: cambridge("aquamarine") },
  { word: "understand", ipa: "/ˌʌn.dəˈstænd/", syllables: ["un", "der", "stand"], stress: 3, level: "hard", source: cambridge("understand") },
  { word: "controversial", ipa: "/ˌkɒn.trəˈvɜː.ʃəl/", syllables: ["con", "tro", "ver", "sial"], stress: 3, level: "hard", source: cambridge("controversial") },
  { word: "television", ipa: "/ˈtel.ɪ.vɪʒ.ən/", ipaAlt: ["/ˈtɛl.ɪ.vɪʒ.ən/"], syllables: ["tel", "e", "vi", "sion"], stress: 1, level: "hard", source: cambridge("television") },
  { word: "university", ipa: "/ˌjuː.nɪˈvɜː.sə.ti/", syllables: ["u", "ni", "ver", "si", "ty"], stress: 3, level: "hard", source: cambridge("university") },
  { word: "employee", ipa: "/ɪmˈplɔɪ.iː/", syllables: ["em", "ploy", "ee"], stress: 2, level: "hard", source: cambridge("employee") },
  { word: "Japanese", ipa: "/ˌdʒæp.ənˈiːz/", syllables: ["Jap", "a", "nese"], stress: 3, level: "hard", source: cambridge("Japanese") },
  { word: "classroom", ipa: "/ˈklɑːs.ruːm/", syllables: ["class", "room"], stress: 1, level: "hard", source: cambridge("classroom") },
  { word: "textbook", ipa: "/ˈtekst.bʊk/", syllables: ["text", "book"], stress: 1, level: "hard", source: cambridge("textbook") },
  { word: "record", ipa: "/ˈrek.ɔːd/", ipaAlt: ["/rɪˈkɔːd/"], syllables: ["re", "cord"], stress: 1, level: "hard", avoidStress: true, source: cambridge("record") },
  { word: "present", ipa: "/ˈprez.ənt/", ipaAlt: ["/prɪˈzent/"], syllables: ["pre", "sent"], stress: 1, level: "hard", avoidStress: true, source: cambridge("present") },
  { word: "produce", ipa: "/ˈprɒd.juːs/", ipaAlt: ["/prəˈdjuːs/"], syllables: ["pro", "duce"], stress: 1, level: "hard", avoidStress: true, source: cambridge("produce") },
  { word: "increase", ipa: "/ˈɪn.kriːs/", ipaAlt: ["/ɪnˈkriːs/"], syllables: ["in", "crease"], stress: 1, level: "hard", avoidStress: true, source: cambridge("increase") },
  { word: "contrast", ipa: "/ˈkɒn.trɑːst/", ipaAlt: ["/kənˈtrɑːst/"], syllables: ["con", "trast"], stress: 1, level: "hard", avoidStress: true, source: cambridge("contrast") },
  { word: "permit", ipa: "/ˈpɜː.mɪt/", ipaAlt: ["/pəˈmɪt/"], syllables: ["per", "mit"], stress: 1, level: "hard", avoidStress: true, source: cambridge("permit") },
  { word: "progress", ipa: "/ˈprəʊ.ɡres/", ipaAlt: ["/prəˈɡres/"], syllables: ["pro", "gress"], stress: 1, level: "hard", avoidStress: true, source: cambridge("progress") }
];

const IPA_KEYS = {
  "Marks": ["ˈ", "ˌ", ".", "ː", " ", "/", "(", ")"],
  "Monophthongs": ["iː", "ɪ", "i", "ʊ", "uː", "e", "ə", "ɜː", "ɔː", "æ", "ʌ", "ɑː", "ɒ"],
  "Diphthongs": ["ɪə", "eɪ", "ʊə", "ɔɪ", "əʊ", "eə", "aɪ", "aʊ"],
  "Consonants": ["p", "b", "t", "d", "k", "ɡ", "f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "tʃ", "dʒ", "h", "m", "n", "ŋ", "r", "l", "w", "j"],
  "Extra English Symbols": ["ʔ", "ɫ", "ɹ", "ɾ", "ʍ", "ɚ", "ɝ", "ᵊ", "ʰ", "̩", "̥", "̃"]
};

const SOUND_CUES = {
  "/p/": "puh",
  "/b/": "buh",
  "/t/": "tuh",
  "/d/": "duh",
  "/k/": "kuh",
  "/g/": "guh",
  "/f/": "fff",
  "/v/": "vvv",
  "/θ/": "th",
  "/ð/": "thuh",
  "/s/": "sss",
  "/z/": "zzz",
  "/ʃ/": "sh",
  "/ʒ/": "zh",
  "/tʃ/": "ch",
  "/dʒ/": "juh",
  "/m/": "mmm",
  "/n/": "nnn",
  "/ŋ/": "ng",
  "/h/": "huh",
  "/l/": "lll",
  "/r/": "ruh",
  "/w/": "wuh",
  "/j/": "yuh",
  "/iː/": "ee",
  "/ɪ/": "ih",
  "/i/": "happy",
  "/e/": "eh",
  "/æ/": "aah",
  "/ʌ/": "uh",
  "/ɑː/": "ah",
  "/ɒ/": "o",
  "/ɔː/": "aw",
  "/ʊ/": "u",
  "/uː/": "oo",
  "/ə/": "uh",
  "/ɜː/": "er",
  "/eɪ/": "ay",
  "/əʊ/": "oh",
  "/aɪ/": "eye",
  "/aʊ/": "ow",
  "/ɔɪ/": "oy",
  "/ɪə/": "ear",
  "/eə/": "air",
  "/ʊə/": "oor",
  "/ˈ/": "primary stress",
  "/ˌ/": "secondary stress",
  "/./": "syllable break",
  "/ː/": "long sound"
};

const SYMBOL_LIBRARY = {
  consonants: [
    { symbol: "/p/", name: "Voiceless bilabial plosive", description: "A consonant made by closing both lips and releasing air without vocal cord vibration.", word: "pen", ipa: "/pen/" },
    { symbol: "/b/", name: "Voiced bilabial plosive", description: "A consonant made by closing both lips and releasing air with vocal cord vibration.", word: "bit", ipa: "/bɪt/" },
    { symbol: "/t/", name: "Voiceless alveolar plosive", description: "The tongue touches the alveolar ridge, then releases air without vocal cord vibration.", word: "tip", ipa: "/tɪp/" },
    { symbol: "/d/", name: "Voiced alveolar plosive", description: "The tongue touches the alveolar ridge, then releases air with vocal cord vibration.", word: "done", ipa: "/dʌn/" },
    { symbol: "/k/", name: "Voiceless velar plosive", description: "The back of the tongue touches the soft palate and releases air without voicing.", word: "cat", ipa: "/kæt/" },
    { symbol: "/g/", name: "Voiced velar plosive", description: "The back of the tongue touches the soft palate and releases air with voicing.", word: "goal", ipa: "/gəʊl/" },
    { symbol: "/f/", name: "Voiceless labiodental fricative", description: "Air passes through a narrow gap between the bottom lip and top teeth without voicing.", word: "fig", ipa: "/fɪg/" },
    { symbol: "/v/", name: "Voiced labiodental fricative", description: "Air passes between the bottom lip and top teeth with vocal cord vibration.", word: "vase", ipa: "/vɑːz/" },
    { symbol: "/θ/", name: "Voiceless dental fricative", description: "The tongue is near the teeth and air passes through without vocal cord vibration.", word: "thought", ipa: "/θɔːt/" },
    { symbol: "/ð/", name: "Voiced dental fricative", description: "The tongue is near the teeth and air passes through with vocal cord vibration.", word: "those", ipa: "/ðəʊz/" },
    { symbol: "/s/", name: "Voiceless alveolar fricative", description: "Air passes through a narrow gap near the alveolar ridge without voicing.", word: "save", ipa: "/seɪv/" },
    { symbol: "/z/", name: "Voiced alveolar fricative", description: "Air passes through a narrow gap near the alveolar ridge with voicing.", word: "zoo", ipa: "/zuː/" },
    { symbol: "/ʃ/", name: "Voiceless postalveolar fricative", description: "Air passes through a narrow gap just behind the alveolar ridge without voicing.", word: "ship", ipa: "/ʃɪp/" },
    { symbol: "/ʒ/", name: "Voiced postalveolar fricative", description: "A voiced fricative sound heard in words like vision and pleasure.", word: "vision", ipa: "/ˈvɪʒən/" },
    { symbol: "/tʃ/", name: "Voiceless postalveolar affricate", description: "A stop sound released into a fricative, without vocal cord vibration.", word: "chip", ipa: "/tʃɪp/" },
    { symbol: "/dʒ/", name: "Voiced postalveolar affricate", description: "A stop sound released into a fricative, with vocal cord vibration.", word: "jam", ipa: "/dʒæm/" },
    { symbol: "/m/", name: "Bilabial nasal", description: "Both lips close and air passes through the nose.", word: "may", ipa: "/meɪ/" },
    { symbol: "/n/", name: "Alveolar nasal", description: "The tongue touches the alveolar ridge and air passes through the nose.", word: "not", ipa: "/nɒt/" },
    { symbol: "/ŋ/", name: "Velar nasal", description: "The back of the tongue touches the soft palate and air passes through the nose.", word: "sing", ipa: "/sɪŋ/" },
    { symbol: "/h/", name: "Voiceless glottal fricative", description: "Air passes through the open vocal folds without voicing.", word: "him", ipa: "/hɪm/" },
    { symbol: "/l/", name: "Alveolar lateral approximant", description: "The tongue touches the alveolar ridge while air flows around the sides.", word: "lie", ipa: "/laɪ/" },
    { symbol: "/r/", name: "Postalveolar approximant", description: "The tongue approaches the postalveolar area without making strong friction.", word: "reach", ipa: "/riːtʃ/" },
    { symbol: "/w/", name: "Labial-velar approximant", description: "The lips round while the back of the tongue approaches the soft palate.", word: "will", ipa: "/wɪl/" },
    { symbol: "/j/", name: "Palatal approximant", description: "The tongue approaches the hard palate, like the first sound in yes.", word: "yet", ipa: "/jet/" }
  ],
  monophthongs: [
    { symbol: "/iː/", name: "Close front long vowel", description: "A long high front vowel with spread lips.", word: "sleep", ipa: "/sliːp/" },
    { symbol: "/ɪ/", name: "Near-close front short vowel", description: "A short high front vowel, more relaxed than /iː/.", word: "slip", ipa: "/slɪp/" },
    { symbol: "/i/", name: "Weak close front vowel", description: "A weak unstressed front vowel, often heard at the end of words like happy and city.", word: "happy", ipa: "/ˈhæp.i/" },
    { symbol: "/e/", name: "Mid front vowel", description: "A short front vowel made with the tongue in a mid position.", word: "ten", ipa: "/ten/" },
    { symbol: "/æ/", name: "Open front vowel", description: "A low front vowel with the mouth quite open.", word: "tap", ipa: "/tæp/" },
    { symbol: "/ʌ/", name: "Open-mid central vowel", description: "A short central vowel used in words like cup and love.", word: "cup", ipa: "/kʌp/" },
    { symbol: "/ɑː/", name: "Open back long vowel", description: "A long low back vowel used in RP words like bar and father.", word: "bar", ipa: "/bɑː/" },
    { symbol: "/ɒ/", name: "Open back rounded vowel", description: "A short back rounded vowel common in RP words like gone and lot.", word: "gone", ipa: "/ɡɒn/" },
    { symbol: "/ɔː/", name: "Open-mid back long rounded vowel", description: "A long rounded back vowel used in words like more and thought.", word: "more", ipa: "/mɔː/" },
    { symbol: "/ʊ/", name: "Near-close back rounded vowel", description: "A short rounded vowel used in good and foot.", word: "good", ipa: "/ɡʊd/" },
    { symbol: "/uː/", name: "Close back long rounded vowel", description: "A long rounded high back vowel used in food and blue.", word: "food", ipa: "/fuːd/" },
    { symbol: "/ə/", name: "Schwa", description: "A weak, central unstressed vowel. It is the most common vowel in English.", word: "better", ipa: "/ˈbetə/" },
    { symbol: "/ɜː/", name: "Long central vowel", description: "A long central vowel used in RP words like word, bird, and nurse.", word: "word", ipa: "/wɜːd/" }
  ],
  diphthongs: [
    { symbol: "/eɪ/", name: "Face diphthong", description: "A vowel glide from a mid front position toward /ɪ/.", word: "game", ipa: "/ɡeɪm/" },
    { symbol: "/əʊ/", name: "Goat diphthong", description: "A vowel glide from central /ə/ toward rounded /ʊ/ in RP.", word: "no", ipa: "/nəʊ/" },
    { symbol: "/aɪ/", name: "Price diphthong", description: "A vowel glide from open /a/ toward /ɪ/.", word: "mine", ipa: "/maɪn/" },
    { symbol: "/aʊ/", name: "Mouth diphthong", description: "A vowel glide from open /a/ toward /ʊ/.", word: "how", ipa: "/haʊ/" },
    { symbol: "/ɔɪ/", name: "Choice diphthong", description: "A vowel glide from rounded back /ɔ/ toward /ɪ/.", word: "toy", ipa: "/tɔɪ/" },
    { symbol: "/ɪə/", name: "Near diphthong", description: "A vowel glide from /ɪ/ toward schwa in RP.", word: "hear", ipa: "/hɪə/" },
    { symbol: "/eə/", name: "Square diphthong", description: "A vowel glide from /e/ toward schwa in RP.", word: "where", ipa: "/weə/" },
    { symbol: "/ʊə/", name: "Cure diphthong", description: "A vowel glide from /ʊ/ toward schwa in RP.", word: "pure", ipa: "/pjʊə/" }
  ],
  stress: [
    { symbol: "/ˈ/", name: "Primary stress mark", description: "Placed before the syllable with the strongest stress in a word.", word: "banana", ipa: "/bəˈnɑːnə/" },
    { symbol: "/ˌ/", name: "Secondary stress mark", description: "Placed before a syllable with weaker stress than the main stress.", word: "understand", ipa: "/ˌʌndəˈstænd/" },
    { symbol: "/./", name: "Syllable boundary", description: "A dot can show where one syllable ends and the next begins.", word: "family", ipa: "/ˈfæm.əl.i/" },
    { symbol: "/ː/", name: "Length mark", description: "Shows that a vowel is long.", word: "sleep", ipa: "/sliːp/" }
  ]
};

const PHONEME_CONSONANTS = [
  { symbol: "/p/", place: "Bilabial", manner: "Plosive", voicing: "Voiceless" },
  { symbol: "/b/", place: "Bilabial", manner: "Plosive", voicing: "Voiced" },
  { symbol: "/t/", place: "Alveolar", manner: "Plosive", voicing: "Voiceless" },
  { symbol: "/d/", place: "Alveolar", manner: "Plosive", voicing: "Voiced" },
  { symbol: "/k/", place: "Velar", manner: "Plosive", voicing: "Voiceless" },
  { symbol: "/g/", place: "Velar", manner: "Plosive", voicing: "Voiced" },
  { symbol: "/f/", place: "Labiodental", manner: "Fricative", voicing: "Voiceless" },
  { symbol: "/v/", place: "Labiodental", manner: "Fricative", voicing: "Voiced" },
  { symbol: "/θ/", place: "Dental", manner: "Fricative", voicing: "Voiceless" },
  { symbol: "/ð/", place: "Dental", manner: "Fricative", voicing: "Voiced" },
  { symbol: "/s/", place: "Alveolar", manner: "Fricative", voicing: "Voiceless" },
  { symbol: "/z/", place: "Alveolar", manner: "Fricative", voicing: "Voiced" },
  { symbol: "/ʃ/", place: "Postalveolar", manner: "Fricative", voicing: "Voiceless" },
  { symbol: "/ʒ/", place: "Postalveolar", manner: "Fricative", voicing: "Voiced" },
  { symbol: "/tʃ/", place: "Postalveolar", manner: "Affricate", voicing: "Voiceless" },
  { symbol: "/dʒ/", place: "Postalveolar", manner: "Affricate", voicing: "Voiced" },
  { symbol: "/m/", place: "Bilabial", manner: "Nasal", voicing: "Voiced" },
  { symbol: "/n/", place: "Alveolar", manner: "Nasal", voicing: "Voiced" },
  { symbol: "/ŋ/", place: "Velar", manner: "Nasal", voicing: "Voiced" },
  { symbol: "/h/", place: "Glottal", manner: "Fricative", voicing: "Voiceless" },
  { symbol: "/l/", place: "Alveolar", manner: "Approximant", voicing: "Voiced" },
  { symbol: "/r/", place: "Postalveolar", manner: "Approximant", voicing: "Voiced" },
  { symbol: "/w/", place: "Labial-velar", manner: "Approximant", voicing: "Voiced" },
  { symbol: "/j/", place: "Palatal", manner: "Approximant", voicing: "Voiced" }
];

const PHONEME_VOWELS = [
  { symbol: "/iː/", height: "Close", backness: "Front", rounding: "Unrounded" },
  { symbol: "/ɪ/", height: "Close", backness: "Front", rounding: "Unrounded" },
  { symbol: "/i/", height: "Close", backness: "Front", rounding: "Unrounded" },
  { symbol: "/e/", height: "Mid", backness: "Front", rounding: "Unrounded" },
  { symbol: "/æ/", height: "Open", backness: "Front", rounding: "Unrounded" },
  { symbol: "/ə/", height: "Mid", backness: "Central", rounding: "Unrounded" },
  { symbol: "/ɜː/", height: "Mid", backness: "Central", rounding: "Unrounded" },
  { symbol: "/ʌ/", height: "Open", backness: "Central", rounding: "Unrounded" },
  { symbol: "/ɑː/", height: "Open", backness: "Back", rounding: "Unrounded" },
  { symbol: "/ɒ/", height: "Open", backness: "Back", rounding: "Rounded" },
  { symbol: "/ɔː/", height: "Mid", backness: "Back", rounding: "Rounded" },
  { symbol: "/ʊ/", height: "Close", backness: "Back", rounding: "Rounded" },
  { symbol: "/uː/", height: "Close", backness: "Back", rounding: "Rounded" }
];

const PHONEME_OPTIONS = {
  place: ["Bilabial", "Labiodental", "Dental", "Alveolar", "Postalveolar", "Palatal", "Velar", "Glottal", "Labial-velar"],
  manner: ["Plosive", "Fricative", "Affricate", "Nasal", "Approximant"],
  voicing: ["Voiceless", "Voiced"],
  height: ["Close", "Mid", "Open"],
  backness: ["Front", "Central", "Back"],
  rounding: ["Rounded", "Unrounded"]
};

const MINIMAL_PAIR_BANK = [
  {
    category: "vowel",
    level: "easy",
    word1: "ship",
    word2: "sheep",
    ukIpa1: "/ʃɪp/",
    ukIpa2: "/ʃiːp/",
    usIpa1: "/ʃɪp/",
    usIpa2: "/ʃip/",
    difference: "Short vowel /ɪ/ vs long vowel /iː/."
  },
  {
    category: "vowel",
    level: "easy",
    word1: "sit",
    word2: "seat",
    ukIpa1: "/sɪt/",
    ukIpa2: "/siːt/",
    usIpa1: "/sɪt/",
    usIpa2: "/sit/",
    difference: "Short vowel /ɪ/ vs long vowel /iː/."
  },
  {
    category: "vowel",
    level: "easy",
    word1: "full",
    word2: "fool",
    ukIpa1: "/fʊl/",
    ukIpa2: "/fuːl/",
    usIpa1: "/fʊl/",
    usIpa2: "/ful/",
    difference: "Short vowel /ʊ/ vs long vowel /uː/."
  },
  {
    category: "vowel",
    level: "medium",
    word1: "bed",
    word2: "bad",
    ukIpa1: "/bed/",
    ukIpa2: "/bæd/",
    usIpa1: "/bed/",
    usIpa2: "/bæd/",
    difference: "Mid front vowel /e/ vs open front vowel /æ/."
  },
  {
    category: "vowel",
    level: "medium",
    word1: "cot",
    word2: "caught",
    ukIpa1: "/kɒt/",
    ukIpa2: "/kɔːt/",
    usIpa1: "/kɑt/",
    usIpa2: "/kɔt/",
    difference: "Open back /ɒ/ or /ɑ/ vs rounded /ɔː/ or /ɔ/."
  },
  {
    category: "vowel",
    level: "medium",
    word1: "heart",
    word2: "hurt",
    ukIpa1: "/hɑːt/",
    ukIpa2: "/hɜːt/",
    usIpa1: "/hɑrt/",
    usIpa2: "/hɝt/",
    difference: "Open back /ɑː/ vs central /ɜː/ or rhotic /ɝ/."
  },
  {
    category: "vowel",
    level: "hard",
    word1: "late",
    word2: "let",
    ukIpa1: "/leɪt/",
    ukIpa2: "/let/",
    usIpa1: "/leɪt/",
    usIpa2: "/let/",
    difference: "Diphthong /eɪ/ vs short vowel /e/."
  },
  {
    category: "vowel",
    level: "hard",
    word1: "law",
    word2: "low",
    ukIpa1: "/lɔː/",
    ukIpa2: "/ləʊ/",
    usIpa1: "/lɔ/",
    usIpa2: "/loʊ/",
    difference: "Rounded vowel /ɔː/ or /ɔ/ vs diphthong /əʊ/ or /oʊ/."
  },
  {
    category: "consonant",
    level: "easy",
    word1: "pin",
    word2: "bin",
    ukIpa1: "/pɪn/",
    ukIpa2: "/bɪn/",
    usIpa1: "/pɪn/",
    usIpa2: "/bɪn/",
    difference: "Voiceless /p/ vs voiced /b/."
  },
  {
    category: "consonant",
    level: "easy",
    word1: "fan",
    word2: "van",
    ukIpa1: "/fæn/",
    ukIpa2: "/væn/",
    usIpa1: "/fæn/",
    usIpa2: "/væn/",
    difference: "Voiceless /f/ vs voiced /v/."
  },
  {
    category: "consonant",
    level: "easy",
    word1: "thin",
    word2: "then",
    ukIpa1: "/θɪn/",
    ukIpa2: "/ðen/",
    usIpa1: "/θɪn/",
    usIpa2: "/ðen/",
    difference: "Voiceless dental /θ/ vs voiced dental /ð/."
  },
  {
    category: "consonant",
    level: "medium",
    word1: "sip",
    word2: "zip",
    ukIpa1: "/sɪp/",
    ukIpa2: "/zɪp/",
    usIpa1: "/sɪp/",
    usIpa2: "/zɪp/",
    difference: "Voiceless /s/ vs voiced /z/."
  },
  {
    category: "consonant",
    level: "medium",
    word1: "cheap",
    word2: "jeep",
    ukIpa1: "/tʃiːp/",
    ukIpa2: "/dʒiːp/",
    usIpa1: "/tʃip/",
    usIpa2: "/dʒip/",
    difference: "Voiceless affricate /tʃ/ vs voiced affricate /dʒ/."
  },
  {
    category: "consonant",
    level: "medium",
    word1: "light",
    word2: "right",
    ukIpa1: "/laɪt/",
    ukIpa2: "/raɪt/",
    usIpa1: "/laɪt/",
    usIpa2: "/raɪt/",
    difference: "Lateral approximant /l/ vs postalveolar approximant /r/."
  },
  {
    category: "consonant",
    level: "hard",
    word1: "sin",
    word2: "sing",
    ukIpa1: "/sɪn/",
    ukIpa2: "/sɪŋ/",
    usIpa1: "/sɪn/",
    usIpa2: "/sɪŋ/",
    difference: "Alveolar nasal /n/ vs velar nasal /ŋ/."
  },
  {
    category: "consonant",
    level: "hard",
    word1: "pressure",
    word2: "pleasure",
    ukIpa1: "/ˈpreʃə/",
    ukIpa2: "/ˈpleʒə/",
    usIpa1: "/ˈpreʃər/",
    usIpa2: "/ˈpleʒər/",
    difference: "Voiceless postalveolar /ʃ/ vs voiced postalveolar /ʒ/."
  }
];

function addMinimalPairs(text) {
  text
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [category, level, word1, word2, ukIpa1, ukIpa2, usIpa1, usIpa2, difference] = line
        .split("|")
        .map((part) => part.trim());
      MINIMAL_PAIR_BANK.push({ category, level, word1, word2, ukIpa1, ukIpa2, usIpa1, usIpa2, difference });
    });
}

addMinimalPairs(`
vowel|easy|bit|beat|/bɪt/|/biːt/|/bɪt/|/bit/|Short vowel /ɪ/ vs long vowel /iː/.
vowel|easy|live|leave|/lɪv/|/liːv/|/lɪv/|/liv/|Short vowel /ɪ/ vs long vowel /iː/.
vowel|easy|pull|pool|/pʊl/|/puːl/|/pʊl/|/pul/|Short vowel /ʊ/ vs long vowel /uː/.
vowel|easy|look|Luke|/lʊk/|/luːk/|/lʊk/|/luk/|Short vowel /ʊ/ vs long vowel /uː/.
vowel|easy|cap|cup|/kæp/|/kʌp/|/kæp/|/kʌp/|Open front /æ/ vs central /ʌ/.
vowel|easy|pan|pen|/pæn/|/pen/|/pæn/|/pen/|Open front /æ/ vs mid front /e/.
vowel|easy|cat|cut|/kæt/|/kʌt/|/kæt/|/kʌt/|Open front /æ/ vs central /ʌ/.
vowel|easy|men|man|/men/|/mæn/|/men/|/mæn/|Mid front /e/ vs open front /æ/.
vowel|easy|hot|hat|/hɒt/|/hæt/|/hɑt/|/hæt/|Back /ɒ/ or /ɑ/ vs front /æ/.
vowel|easy|not|nut|/nɒt/|/nʌt/|/nɑt/|/nʌt/|Back /ɒ/ or /ɑ/ vs central /ʌ/.
consonant|easy|pat|bat|/pæt/|/bæt/|/pæt/|/bæt/|Voiceless /p/ vs voiced /b/.
consonant|easy|tin|din|/tɪn/|/dɪn/|/tɪn/|/dɪn/|Voiceless /t/ vs voiced /d/.
consonant|easy|coat|goat|/kəʊt/|/ɡəʊt/|/koʊt/|/ɡoʊt/|Voiceless /k/ vs voiced /ɡ/.
consonant|easy|sue|zoo|/suː/|/zuː/|/su/|/zu/|Voiceless /s/ vs voiced /z/.
consonant|easy|seal|zeal|/siːl/|/ziːl/|/sil/|/zil/|Voiceless /s/ vs voiced /z/.
consonant|easy|chain|Jane|/tʃeɪn/|/dʒeɪn/|/tʃeɪn/|/dʒeɪn/|Voiceless /tʃ/ vs voiced /dʒ/.
consonant|easy|chin|gin|/tʃɪn/|/dʒɪn/|/tʃɪn/|/dʒɪn/|Voiceless /tʃ/ vs voiced /dʒ/.
consonant|easy|came|game|/keɪm/|/ɡeɪm/|/keɪm/|/ɡeɪm/|Voiceless /k/ vs voiced /ɡ/.
consonant|easy|toe|doe|/təʊ/|/dəʊ/|/toʊ/|/doʊ/|Voiceless /t/ vs voiced /d/.
consonant|easy|fine|vine|/faɪn/|/vaɪn/|/faɪn/|/vaɪn/|Voiceless /f/ vs voiced /v/.
vowel|medium|bet|bait|/bet/|/beɪt/|/bet/|/beɪt/|Short vowel /e/ vs diphthong /eɪ/.
vowel|medium|met|mate|/met/|/meɪt/|/met/|/meɪt/|Short vowel /e/ vs diphthong /eɪ/.
vowel|medium|sell|sail|/sel/|/seɪl/|/sel/|/seɪl/|Short vowel /e/ vs diphthong /eɪ/.
vowel|medium|bought|boat|/bɔːt/|/bəʊt/|/bɔt/|/boʊt/|Rounded /ɔː/ or /ɔ/ vs diphthong /əʊ/ or /oʊ/.
vowel|medium|caught|coat|/kɔːt/|/kəʊt/|/kɔt/|/koʊt/|Rounded /ɔː/ or /ɔ/ vs diphthong /əʊ/ or /oʊ/.
vowel|medium|cart|cut|/kɑːt/|/kʌt/|/kɑrt/|/kʌt/|Open back /ɑː/ or /ɑr/ vs central /ʌ/.
vowel|medium|food|foot|/fuːd/|/fʊt/|/fud/|/fʊt/|Long /uː/ vs short /ʊ/.
vowel|medium|bed|bird|/bed/|/bɜːd/|/bed/|/bɝd/|Front /e/ vs central /ɜː/ or rhotic /ɝ/.
vowel|medium|bad|bard|/bæd/|/bɑːd/|/bæd/|/bɑrd/|Front /æ/ vs back /ɑː/ or /ɑr/.
vowel|medium|lock|luck|/lɒk/|/lʌk/|/lɑk/|/lʌk/|Back /ɒ/ or /ɑ/ vs central /ʌ/.
vowel|medium|ankle|uncle|/ˈæŋkl/|/ˈʌŋkl/|/ˈæŋkəl/|/ˈʌŋkəl/|Front /æ/ vs central /ʌ/.
vowel|medium|ferry|fairy|/ˈferi/|/ˈfeəri/|/ˈferi/|/ˈferi/|Short /e/ vs centring diphthong /eə/ in RP.
consonant|medium|rice|lice|/raɪs/|/laɪs/|/raɪs/|/laɪs/|Approximant /r/ vs lateral /l/.
consonant|medium|sip|ship|/sɪp/|/ʃɪp/|/sɪp/|/ʃɪp/|Alveolar /s/ vs postalveolar /ʃ/.
consonant|medium|seat|sheet|/siːt/|/ʃiːt/|/sit/|/ʃit/|Alveolar /s/ vs postalveolar /ʃ/.
consonant|medium|watch|wash|/wɒtʃ/|/wɒʃ/|/wɑtʃ/|/wɑʃ/|Affricate /tʃ/ vs fricative /ʃ/.
consonant|medium|berry|very|/ˈberi/|/ˈveri/|/ˈberi/|/ˈveri/|Bilabial /b/ vs labiodental /v/.
consonant|medium|mouth|mouse|/maʊθ/|/maʊs/|/maʊθ/|/maʊs/|Dental /θ/ vs alveolar /s/.
consonant|medium|wreath|wreathe|/riːθ/|/riːð/|/riθ/|/rið/|Voiceless /θ/ vs voiced /ð/.
consonant|medium|badge|batch|/bædʒ/|/bætʃ/|/bædʒ/|/bætʃ/|Voiced /dʒ/ vs voiceless /tʃ/.
consonant|medium|crate|great|/kreɪt/|/ɡreɪt/|/kreɪt/|/ɡreɪt/|Voiceless /k/ vs voiced /ɡ/.
consonant|medium|fan|pan|/fæn/|/pæn/|/fæn/|/pæn/|Labiodental /f/ vs bilabial /p/.
consonant|medium|cash|catch|/kæʃ/|/kætʃ/|/kæʃ/|/kætʃ/|Fricative /ʃ/ vs affricate /tʃ/.
consonant|medium|sin|thin|/sɪn/|/θɪn/|/sɪn/|/θɪn/|Alveolar /s/ vs dental /θ/.
vowel|hard|heel|hill|/hiːl/|/hɪl/|/hil/|/hɪl/|Long /iː/ vs short /ɪ/.
vowel|hard|feel|fill|/fiːl/|/fɪl/|/fil/|/fɪl/|Long /iː/ vs short /ɪ/.
vowel|hard|fool|full|/fuːl/|/fʊl/|/ful/|/fʊl/|Long /uː/ vs short /ʊ/.
vowel|hard|pool|pull|/puːl/|/pʊl/|/pul/|/pʊl/|Long /uː/ vs short /ʊ/.
vowel|hard|leave|live|/liːv/|/lɪv/|/liv/|/lɪv/|Long /iː/ vs short /ɪ/.
vowel|hard|Luke|look|/luːk/|/lʊk/|/luk/|/lʊk/|Long /uː/ vs short /ʊ/.
vowel|hard|heart|hurt|/hɑːt/|/hɜːt/|/hɑrt/|/hɝt/|Open back /ɑː/ vs central /ɜː/ or rhotic /ɝ/.
vowel|hard|bark|buck|/bɑːk/|/bʌk/|/bɑrk/|/bʌk/|Open back /ɑː/ or /ɑr/ vs central /ʌ/.
vowel|hard|walk|work|/wɔːk/|/wɜːk/|/wɔk/|/wɝk/|Rounded /ɔː/ or /ɔ/ vs central /ɜː/ or rhotic /ɝ/.
vowel|hard|born|burn|/bɔːn/|/bɜːn/|/bɔrn/|/bɝn/|Rounded /ɔː/ or /ɔr/ vs central /ɜː/ or rhotic /ɝ/.
vowel|hard|short|shirt|/ʃɔːt/|/ʃɜːt/|/ʃɔrt/|/ʃɝt/|Rounded /ɔː/ or /ɔr/ vs central /ɜː/ or rhotic /ɝ/.
vowel|hard|cord|curd|/kɔːd/|/kɜːd/|/kɔrd/|/kɝd/|Rounded /ɔː/ or /ɔr/ vs central /ɜː/ or rhotic /ɝ/.
vowel|hard|caught|cut|/kɔːt/|/kʌt/|/kɔt/|/kʌt/|Rounded /ɔː/ or /ɔ/ vs central /ʌ/.
vowel|hard|coat|cot|/kəʊt/|/kɒt/|/koʊt/|/kɑt/|Diphthong /əʊ/ or /oʊ/ vs back /ɒ/ or /ɑ/.
vowel|hard|mate|met|/meɪt/|/met/|/meɪt/|/met/|Diphthong /eɪ/ vs short /e/.
vowel|hard|pain|pen|/peɪn/|/pen/|/peɪn/|/pen/|Diphthong /eɪ/ vs short /e/.
vowel|hard|wander|wonder|/ˈwɒndə/|/ˈwʌndə/|/ˈwɑndər/|/ˈwʌndər/|Back /ɒ/ or /ɑ/ vs central /ʌ/.
vowel|hard|staff|stuff|/stɑːf/|/stʌf/|/stæf/|/stʌf/|Open /ɑː/ or /æ/ vs central /ʌ/.
consonant|hard|thigh|thy|/θaɪ/|/ðaɪ/|/θaɪ/|/ðaɪ/|Voiceless dental /θ/ vs voiced dental /ð/.
consonant|hard|breath|breathe|/breθ/|/briːð/|/breθ/|/brið/|Voiceless /θ/ vs voiced /ð/.
consonant|hard|safe|save|/seɪf/|/seɪv/|/seɪf/|/seɪv/|Voiceless /f/ vs voiced /v/.
consonant|hard|leaf|leave|/liːf/|/liːv/|/lif/|/liv/|Voiceless /f/ vs voiced /v/.
consonant|hard|mission|vision|/ˈmɪʃən/|/ˈvɪʒən/|/ˈmɪʃən/|/ˈvɪʒən/|Voiceless /ʃ/ vs voiced /ʒ/.
consonant|hard|choke|joke|/tʃəʊk/|/dʒəʊk/|/tʃoʊk/|/dʒoʊk/|Voiceless /tʃ/ vs voiced /dʒ/.
consonant|hard|rich|ridge|/rɪtʃ/|/rɪdʒ/|/rɪtʃ/|/rɪdʒ/|Voiceless /tʃ/ vs voiced /dʒ/.
consonant|hard|batch|badge|/bætʃ/|/bædʒ/|/bætʃ/|/bædʒ/|Voiceless /tʃ/ vs voiced /dʒ/.
consonant|hard|lock|rock|/lɒk/|/rɒk/|/lɑk/|/rɑk/|Lateral /l/ vs approximant /r/.
consonant|hard|glass|grass|/ɡlɑːs/|/ɡrɑːs/|/ɡlæs/|/ɡræs/|Lateral /l/ vs approximant /r/.
consonant|hard|west|vest|/west/|/vest/|/west/|/vest/|Approximant /w/ vs labiodental /v/.
consonant|hard|ten|den|/ten/|/den/|/ten/|/den/|Voiceless /t/ vs voiced /d/.
consonant|hard|cap|gap|/kæp/|/ɡæp/|/kæp/|/ɡæp/|Voiceless /k/ vs voiced /ɡ/.
consonant|hard|pack|back|/pæk/|/bæk/|/pæk/|/bæk/|Voiceless /p/ vs voiced /b/.
consonant|hard|bus|buzz|/bʌs/|/bʌz/|/bʌs/|/bʌz/|Voiceless /s/ vs voiced /z/.
consonant|hard|race|raise|/reɪs/|/reɪz/|/reɪs/|/reɪz/|Voiceless /s/ vs voiced /z/.
consonant|hard|sink|think|/sɪŋk/|/θɪŋk/|/sɪŋk/|/θɪŋk/|Alveolar /s/ vs dental /θ/.
consonant|hard|sing|thing|/sɪŋ/|/θɪŋ/|/sɪŋ/|/θɪŋ/|Alveolar /s/ vs dental /θ/.
`);

const SENTENCE_BANK = [
  { text: "I love you.", ipa: "/aɪ ˈlʌv juː/", usIpa: "/aɪ ˈlʌv juː/", level: "easy" },
  { text: "I have a dog.", ipa: "/aɪ hæv ə dɒɡ/", usIpa: "/aɪ hæv ə dɑːɡ/", level: "easy" },
  { text: "Look at the book.", ipa: "/lʊk ət ðə bʊk/", usIpa: "/lʊk ət ðə bʊk/", level: "easy" },
  { text: "She has a cat.", ipa: "/ʃiː hæz ə kæt/", usIpa: "/ʃiː hæz ə kæt/", level: "easy" },
  { text: "He is my friend.", ipa: "/hiː ɪz maɪ frend/", usIpa: "/hiː ɪz maɪ frend/", level: "easy" },
  { text: "We can go home.", ipa: "/wiː kən ɡəʊ həʊm/", usIpa: "/wiː kən ɡoʊ hoʊm/", level: "easy" },
  { text: "This is very good.", ipa: "/ðɪs ɪz ˈver.i ɡʊd/", usIpa: "/ðɪs ɪz ˈver.i ɡʊd/", level: "easy" },
  { text: "The sun is hot.", ipa: "/ðə sʌn ɪz hɒt/", usIpa: "/ðə sʌn ɪz hɑːt/", level: "easy" },
  { text: "My phone is new.", ipa: "/maɪ fəʊn ɪz njuː/", usIpa: "/maɪ foʊn ɪz nuː/", level: "easy" },
  { text: "They like music.", ipa: "/ðeɪ laɪk ˈmjuː.zɪk/", usIpa: "/ðeɪ laɪk ˈmjuː.zɪk/", level: "easy" },
  { text: "I look at the sky.", ipa: "/aɪ lʊk ət ðə skaɪ/", usIpa: "/aɪ lʊk ət ðə skaɪ/", level: "easy" },
  { text: "We eat breakfast at home.", ipa: "/wiː iːt ˈbrek.fəst ət həʊm/", usIpa: "/wiː iːt ˈbrek.fəst ət hoʊm/", level: "easy" },
  { text: "The bus is late.", ipa: "/ðə bʌs ɪz leɪt/", usIpa: "/ðə bʌs ɪz leɪt/", level: "easy" },
  { text: "Open the door please.", ipa: "/ˈəʊ.pən ðə dɔː pliːz/", usIpa: "/ˈoʊ.pən ðə dɔːr pliːz/", level: "easy" },
  { text: "You can speak English.", ipa: "/juː kən spiːk ˈɪŋ.ɡlɪʃ/", usIpa: "/juː kən spiːk ˈɪŋ.ɡlɪʃ/", level: "medium" },
  { text: "The teacher is in the classroom.", ipa: "/ðə ˈtiː.tʃə ɪz ɪn ðə ˈklɑːs.ruːm/", usIpa: "/ðə ˈtiː.tʃɚ ɪz ɪn ðə ˈklæs.ruːm/", level: "medium" },
  { text: "I wanted some fresh air.", ipa: "/aɪ ˈwɒn.tɪd səm freʃ eə/", usIpa: "/aɪ ˈwɑːn.t̬ɪd səm freʃ er/", level: "medium" },
  { text: "She studies phonetics every day.", ipa: "/ʃiː ˈstʌd.iz fəˈnet.ɪks ˈev.ri deɪ/", usIpa: "/ʃiː ˈstʌd.iz fəˈnet.ɪks ˈev.ri deɪ/", level: "medium" },
  { text: "The student opened the window.", ipa: "/ðə ˈstjuː.dənt ˈəʊ.pənd ðə ˈwɪn.dəʊ/", usIpa: "/ðə ˈstuː.dənt ˈoʊ.pənd ðə ˈwɪn.doʊ/", level: "medium" },
  { text: "Can you repeat the question.", ipa: "/kæn juː rɪˈpiːt ðə ˈkwes.tʃən/", usIpa: "/kæn juː rɪˈpiːt ðə ˈkwes.tʃən/", level: "medium" },
  { text: "My brother bought a car.", ipa: "/maɪ ˈbrʌð.ə bɔːt ə kɑː/", usIpa: "/maɪ ˈbrʌð.ɚ bɑːt ə kɑːr/", level: "medium" },
  { text: "The family went to London.", ipa: "/ðə ˈfæm.əl.i went tə ˈlʌn.dən/", usIpa: "/ðə ˈfæm.əl.i went tə ˈlʌn.dən/", level: "medium" },
  { text: "We watched television last night.", ipa: "/wiː wɒtʃt ˈtel.ɪ.vɪʒ.ən lɑːst naɪt/", usIpa: "/wiː wɑːtʃt ˈtel.ɪ.vɪʒ.ən læst naɪt/", level: "medium" },
  { text: "Please write the answer clearly.", ipa: "/pliːz raɪt ði ˈɑːn.sə ˈklɪə.li/", usIpa: "/pliːz raɪt ði ˈæn.sɚ ˈklɪr.li/", level: "medium" },
  { text: "I will call you after lunch.", ipa: "/aɪ wɪl kɔːl juː ˈɑːf.tə lʌntʃ/", usIpa: "/aɪ wɪl kɔːl juː ˈæf.tɚ lʌntʃ/", level: "medium" },
  { text: "The train arrived early today.", ipa: "/ðə treɪn əˈraɪvd ˈɜː.li təˈdeɪ/", usIpa: "/ðə treɪn əˈraɪvd ˈɝː.li təˈdeɪ/", level: "medium" },
  { text: "She wants a cup of coffee.", ipa: "/ʃiː wɒnts ə kʌp əv ˈkɒf.i/", usIpa: "/ʃiː wɑːnts ə kʌp əv ˈkɑː.fi/", level: "medium" },
  { text: "They are waiting outside the station.", ipa: "/ðeɪ ə ˈweɪ.tɪŋ ˌaʊtˈsaɪd ðə ˈsteɪ.ʃən/", usIpa: "/ðeɪ ɑːr ˈweɪ.t̬ɪŋ ˌaʊtˈsaɪd ðə ˈsteɪ.ʃən/", level: "medium" },
  { text: "Phonetics is important.", ipa: "/fəˈnet.ɪks ɪz ɪmˈpɔː.tənt/", usIpa: "/fəˈnet.ɪks ɪz ɪmˈpɔːr.tənt/", level: "hard" },
  { text: "I understand the transcription.", ipa: "/aɪ ˌʌn.dəˈstænd ðə trænˈskrɪp.ʃən/", usIpa: "/aɪ ˌʌn.dɚˈstænd ðə trænˈskrɪp.ʃən/", level: "hard" },
  { text: "Connected speech often includes weak forms.", ipa: "/kəˈnek.tɪd spiːtʃ ˈɒf.ən ɪnˈkluːdz wiːk fɔːmz/", usIpa: "/kəˈnek.tɪd spiːtʃ ˈɑːf.ən ɪnˈkluːdz wiːk fɔːrmz/", level: "hard" },
  { text: "The pronunciation changes in casual conversation.", ipa: "/ðə prəˌnʌn.siˈeɪ.ʃən ˈtʃeɪn.dʒɪz ɪn ˈkæʒ.ju.əl ˌkɒn.vəˈseɪ.ʃən/", usIpa: "/ðə prəˌnʌn.siˈeɪ.ʃən ˈtʃeɪn.dʒɪz ɪn ˈkæʒ.ju.əl ˌkɑːn.vɚˈseɪ.ʃən/", level: "hard" },
  { text: "University students need accurate transcription practice.", ipa: "/ˌjuː.nɪˈvɜː.sə.ti ˈstjuː.dənts niːd ˈæk.jə.rət trænˈskrɪp.ʃən ˈpræk.tɪs/", usIpa: "/ˌjuː.nəˈvɝː.sə.t̬i ˈstuː.dənts niːd ˈæk.jɚ.ət trænˈskrɪp.ʃən ˈpræk.tɪs/", level: "hard" },
  { text: "The dictionary gives several possible pronunciations.", ipa: "/ðə ˈdɪk.ʃən.ər.i ɡɪvz ˈsev.rəl ˈpɒs.ə.bəl prəˌnʌn.siˈeɪ.ʃənz/", usIpa: "/ðə ˈdɪk.ʃən.er.i ɡɪvz ˈsev.rəl ˈpɑː.sə.bəl prəˌnʌn.siˈeɪ.ʃənz/", level: "hard" },
  { text: "Stress can move when a word becomes part of a phrase.", ipa: "/stres kæn muːv wen ə wɜːd bɪˈkʌmz pɑːt əv ə freɪz/", usIpa: "/stres kæn muːv wen ə wɝːd bɪˈkʌmz pɑːrt əv ə freɪz/", level: "hard" },
  { text: "Syllabification helps students hear the rhythm of English.", ipa: "/sɪˌlæb.ɪ.fɪˈkeɪ.ʃən helps ˈstjuː.dənts hɪə ðə ˈrɪð.əm əv ˈɪŋ.ɡlɪʃ/", usIpa: "/sɪˌlæb.ə.fəˈkeɪ.ʃən helps ˈstuː.dənts hɪr ðə ˈrɪð.əm əv ˈɪŋ.ɡlɪʃ/", level: "hard" },
  { text: "American and British vowels are not always the same.", ipa: "/əˈmer.ɪ.kən ənd ˈbrɪt.ɪʃ ˈvaʊ.əlz ə nɒt ˈɔːl.weɪz ðə seɪm/", usIpa: "/əˈmer.ə.kən ənd ˈbrɪt̬.ɪʃ ˈvaʊ.əlz ɑːr nɑːt ˈɑːl.weɪz ðə seɪm/", level: "hard" }
];

SENTENCE_BANK.push(
  { text: "The cat is sleeping.", ipa: "/ðə kæt ɪz ˈsliːpɪŋ/", usIpa: "/ðə kæt ɪz ˈslipɪŋ/", level: "easy" },
  { text: "She likes apples.", ipa: "/ʃiː laɪks ˈæpəlz/", usIpa: "/ʃi laɪks ˈæpəlz/", level: "easy" },
  { text: "We are ready.", ipa: "/wiː ə ˈredi/", usIpa: "/wi ɑːr ˈredi/", level: "easy" },
  { text: "He isn't here.", ipa: "/hiː ˈɪznt hɪə/", usIpa: "/hi ˈɪznt hɪr/", level: "easy" },
  { text: "Don't be late.", ipa: "/dəʊnt biː leɪt/", usIpa: "/doʊnt bi leɪt/", level: "easy" },
  { text: "Are you okay?", ipa: "/ɑː juː əʊˈkeɪ/", usIpa: "/ɑːr ju oʊˈkeɪ/", level: "easy" },
  { text: "I can't swim.", ipa: "/aɪ kɑːnt swɪm/", usIpa: "/aɪ kænt swɪm/", level: "easy" },
  { text: "The door is open.", ipa: "/ðə dɔːr ɪz ˈəʊpən/", usIpa: "/ðə dɔːr ɪz ˈoʊpən/", level: "easy" },
  { text: "My bag is heavy.", ipa: "/maɪ bæɡ ɪz ˈhevi/", usIpa: "/maɪ bæɡ ɪz ˈhevi/", level: "easy" },
  { text: "This book is mine.", ipa: "/ðɪs bʊk ɪz maɪn/", usIpa: "/ðɪs bʊk ɪz maɪn/", level: "easy" },
  { text: "They aren't ready.", ipa: "/ðeɪ ɑːnt ˈredi/", usIpa: "/ðeɪ ɑːrnt ˈredi/", level: "easy" },
  { text: "Is it raining?", ipa: "/ɪz ɪt ˈreɪnɪŋ/", usIpa: "/ɪz ɪt ˈreɪnɪŋ/", level: "easy" },
  { text: "Please sit down.", ipa: "/pliːz sɪt daʊn/", usIpa: "/pliz sɪt daʊn/", level: "easy" },
  { text: "The baby is hungry.", ipa: "/ðə ˈbeɪbi ɪz ˈhʌŋɡri/", usIpa: "/ðə ˈbeɪbi ɪz ˈhʌŋɡri/", level: "easy" },
  { text: "Can we start?", ipa: "/kæn wiː stɑːt/", usIpa: "/kæn wi stɑːrt/", level: "easy" },
  { text: "I need water.", ipa: "/aɪ niːd ˈwɔːtə/", usIpa: "/aɪ nid ˈwɔːtər/", level: "easy" },
  { text: "She didn't call.", ipa: "/ʃiː ˈdɪdnt kɔːl/", usIpa: "/ʃi ˈdɪdnt kɔːl/", level: "easy" },
  { text: "Where is my phone?", ipa: "/weər ɪz maɪ fəʊn/", usIpa: "/wer ɪz maɪ foʊn/", level: "easy" },
  { text: "The room was quiet.", ipa: "/ðə ruːm wəz ˈkwaɪət/", usIpa: "/ðə rum wəz ˈkwaɪət/", level: "easy" },
  { text: "Let's go now.", ipa: "/lets ɡəʊ naʊ/", usIpa: "/lets ɡoʊ naʊ/", level: "easy" },
  { text: "The teacher is speaking very clearly.", ipa: "/ðə ˈtiːtʃər ɪz ˈspiːkɪŋ ˈveri ˈklɪəli/", usIpa: "/ðə ˈtitʃər ɪz ˈspikɪŋ ˈveri ˈklɪrli/", level: "medium" },
  { text: "My brother is watching television.", ipa: "/maɪ ˈbrʌðər ɪz ˈwɒtʃɪŋ ˈtelɪvɪʒən/", usIpa: "/maɪ ˈbrʌðər ɪz ˈwɑːtʃɪŋ ˈtelɪvɪʒən/", level: "medium" },
  { text: "We don't have enough time.", ipa: "/wiː dəʊnt hæv ɪˈnʌf taɪm/", usIpa: "/wi doʊnt hæv ɪˈnʌf taɪm/", level: "medium" },
  { text: "Did you finish your homework?", ipa: "/dɪd juː ˈfɪnɪʃ jɔː ˈhəʊmwɜːk/", usIpa: "/dɪd ju ˈfɪnɪʃ jɔːr ˈhoʊmwɝːk/", level: "medium" },
  { text: "The children are playing outside.", ipa: "/ðə ˈtʃɪldrən ə ˈpleɪɪŋ ˌaʊtˈsaɪd/", usIpa: "/ðə ˈtʃɪldrən ɑːr ˈpleɪɪŋ ˌaʊtˈsaɪd/", level: "medium" },
  { text: "I haven't seen that movie.", ipa: "/aɪ ˈhævnt siːn ðæt ˈmuːvi/", usIpa: "/aɪ ˈhævnt sin ðæt ˈmuvi/", level: "medium" },
  { text: "She can answer the question.", ipa: "/ʃiː kən ˈɑːnsə ðə ˈkwestʃən/", usIpa: "/ʃi kən ˈænsər ðə ˈkwestʃən/", level: "medium" },
  { text: "Why are they leaving early?", ipa: "/waɪ ə ðeɪ ˈliːvɪŋ ˈɜːli/", usIpa: "/waɪ ɑːr ðeɪ ˈlivɪŋ ˈɝːli/", level: "medium" },
  { text: "The coffee is too hot.", ipa: "/ðə ˈkɒfi ɪz tuː hɒt/", usIpa: "/ðə ˈkɑːfi ɪz tu hɑːt/", level: "medium" },
  { text: "I'll meet you after class.", ipa: "/aɪl miːt juː ˈɑːftə klɑːs/", usIpa: "/aɪl mit ju ˈæftər klæs/", level: "medium" },
  { text: "The weather wasn't very nice.", ipa: "/ðə ˈweðə ˈwɒznt ˈveri naɪs/", usIpa: "/ðə ˈweðər ˈwɑːznt ˈveri naɪs/", level: "medium" },
  { text: "Can you speak more slowly?", ipa: "/kæn juː spiːk mɔː ˈsləʊli/", usIpa: "/kæn ju spik mɔːr ˈsloʊli/", level: "medium" },
  { text: "They've already opened the window.", ipa: "/ðeɪv ɔːlˈredi ˈəʊpənd ðə ˈwɪndəʊ/", usIpa: "/ðeɪv ɔːlˈredi ˈoʊpənd ðə ˈwɪndoʊ/", level: "medium" },
  { text: "I was waiting at the station.", ipa: "/aɪ wəz ˈweɪtɪŋ ət ðə ˈsteɪʃən/", usIpa: "/aɪ wəz ˈweɪtɪŋ ət ðə ˈsteɪʃən/", level: "medium" },
  { text: "She likes reading in the evening.", ipa: "/ʃiː laɪks ˈriːdɪŋ ɪn ði ˈiːvnɪŋ/", usIpa: "/ʃi laɪks ˈridɪŋ ɪn ði ˈivnɪŋ/", level: "medium" },
  { text: "The train doesn't stop here.", ipa: "/ðə treɪn ˈdʌznt stɒp hɪə/", usIpa: "/ðə treɪn ˈdʌznt stɑːp hɪr/", level: "medium" },
  { text: "Is your sister coming today?", ipa: "/ɪz jɔː ˈsɪstə ˈkʌmɪŋ təˈdeɪ/", usIpa: "/ɪz jɔːr ˈsɪstər ˈkʌmɪŋ təˈdeɪ/", level: "medium" },
  { text: "We should practise every morning.", ipa: "/wiː ʃʊd ˈpræktɪs ˈevri ˈmɔːnɪŋ/", usIpa: "/wi ʃʊd ˈpræktɪs ˈevri ˈmɔːrnɪŋ/", level: "medium" },
  { text: "There isn't a simple answer.", ipa: "/ðeər ˈɪznt ə ˈsɪmpl ˈɑːnsə/", usIpa: "/ðer ˈɪznt ə ˈsɪmpəl ˈænsər/", level: "medium" },
  { text: "The students were preparing carefully for their final exams.", ipa: "/ðə ˈstjuːdənts wə prɪˈpeərɪŋ ˈkeəfəli fə ðeə ˈfaɪnəl ɪɡˈzæmz/", usIpa: "/ðə ˈstudənts wər prɪˈperɪŋ ˈkerfəli fər ðer ˈfaɪnəl ɪɡˈzæmz/", level: "hard" },
  { text: "Pronunciation practice improves listening and speaking skills.", ipa: "/prəˌnʌnsiˈeɪʃən ˈpræktɪs ɪmˈpruːvz ˈlɪsənɪŋ ənd ˈspiːkɪŋ skɪlz/", usIpa: "/prəˌnʌnsiˈeɪʃən ˈpræktɪs ɪmˈpruvz ˈlɪsənɪŋ ənd ˈspikɪŋ skɪlz/", level: "hard" },
  { text: "She couldn't understand the complicated instructions.", ipa: "/ʃiː ˈkʊdnt ˌʌndəˈstænd ðə ˈkɒmplɪkeɪtɪd ɪnˈstrʌkʃənz/", usIpa: "/ʃi ˈkʊdnt ˌʌndərˈstænd ðə ˈkɑːmplɪkeɪtɪd ɪnˈstrʌkʃənz/", level: "hard" },
  { text: "The classroom was surprisingly quiet during the examination.", ipa: "/ðə ˈklɑːsruːm wəz səˈpraɪzɪŋli ˈkwaɪət ˈdjʊərɪŋ ði ɪɡˌzæmɪˈneɪʃən/", usIpa: "/ðə ˈklæsrum wəz sərˈpraɪzɪŋli ˈkwaɪət ˈdʊrɪŋ ði ɪɡˌzæməˈneɪʃən/", level: "hard" },
  { text: "Would you like to review the transcription together?", ipa: "/wʊd juː laɪk tə rɪˈvjuː ðə trænˈskrɪpʃən təˈɡeðə/", usIpa: "/wʊd ju laɪk tə rɪˈvju ðə trænˈskrɪpʃən təˈɡeðər/", level: "hard" },
  { text: "The international conference begins tomorrow afternoon.", ipa: "/ði ˌɪntəˈnæʃənəl ˈkɒnfərəns bɪˈɡɪnz təˈmɒrəʊ ˌɑːftəˈnuːn/", usIpa: "/ði ˌɪntərˈnæʃənəl ˈkɑːnfərəns bɪˈɡɪnz təˈmɑːroʊ ˌæftərˈnun/", level: "hard" },
  { text: "I shouldn't have forgotten the vocabulary notebook.", ipa: "/aɪ ˈʃʊdnt əv fəˈɡɒtn ðə vəˈkæbjələri ˈnəʊtbʊk/", usIpa: "/aɪ ˈʃʊdnt əv fərˈɡɑːtn ðə voʊˈkæbjəleri ˈnoʊtbʊk/", level: "hard" },
  { text: "The speaker stressed the most important information.", ipa: "/ðə ˈspiːkə strest ðə məʊst ɪmˈpɔːtənt ˌɪnfəˈmeɪʃən/", usIpa: "/ðə ˈspikər strest ðə moʊst ɪmˈpɔːrtənt ˌɪnfərˈmeɪʃən/", level: "hard" },
  { text: "Students often reduce function words in connected speech.", ipa: "/ˈstjuːdənts ˈɒfən rɪˈdjuːs ˈfʌŋkʃən wɜːdz ɪn kəˈnektɪd spiːtʃ/", usIpa: "/ˈstudənts ˈɑːfən rɪˈdus ˈfʌŋkʃən wɝːdz ɪn kəˈnektɪd spitʃ/", level: "hard" },
  { text: "Can accurate listening improve your pronunciation quickly?", ipa: "/kən ˈækjərət ˈlɪsənɪŋ ɪmˈpruːv jɔː prəˌnʌnsiˈeɪʃən ˈkwɪkli/", usIpa: "/kən ˈækjərət ˈlɪsənɪŋ ɪmˈpruv jɔːr prəˌnʌnsiˈeɪʃən ˈkwɪkli/", level: "hard" },
  { text: "The library doesn't allow noisy conversations inside.", ipa: "/ðə ˈlaɪbrəri ˈdʌznt əˈlaʊ ˈnɔɪzi ˌkɒnvəˈseɪʃənz ɪnˈsaɪd/", usIpa: "/ðə ˈlaɪbreri ˈdʌznt əˈlaʊ ˈnɔɪzi ˌkɑːnvərˈseɪʃənz ɪnˈsaɪd/", level: "hard" },
  { text: "They've been discussing several possible solutions.", ipa: "/ðeɪv bɪn dɪˈskʌsɪŋ ˈsevərəl ˈpɒsəbəl səˈluːʃənz/", usIpa: "/ðeɪv bɪn dɪˈskʌsɪŋ ˈsevərəl ˈpɑːsəbəl səˈluʃənz/", level: "hard" },
  { text: "The recording includes examples of natural rhythm.", ipa: "/ðə rɪˈkɔːdɪŋ ɪnˈkluːdz ɪɡˈzɑːmpəlz əv ˈnætʃərəl ˈrɪðəm/", usIpa: "/ðə rɪˈkɔːrdɪŋ ɪnˈkludz ɪɡˈzæmpəlz əv ˈnætʃərəl ˈrɪðəm/", level: "hard" },
  { text: "Why didn't the candidate answer confidently?", ipa: "/waɪ ˈdɪdnt ðə ˈkændɪdət ˈɑːnsə ˈkɒnfɪdəntli/", usIpa: "/waɪ ˈdɪdnt ðə ˈkændədeɪt ˈænsər ˈkɑːnfɪdəntli/", level: "hard" },
  { text: "The phrase contains three difficult consonant clusters.", ipa: "/ðə freɪz kənˈteɪnz θriː ˈdɪfɪkəlt ˈkɒnsənənt ˈklʌstəz/", usIpa: "/ðə freɪz kənˈteɪnz θri ˈdɪfɪkəlt ˈkɑːnsənənt ˈklʌstərz/", level: "hard" },
  { text: "Careful transcription helps students notice small sound changes.", ipa: "/ˈkeəfəl trænˈskrɪpʃən helps ˈstjuːdənts ˈnəʊtɪs smɔːl saʊnd ˈtʃeɪndʒɪz/", usIpa: "/ˈkerfəl trænˈskrɪpʃən helps ˈstudənts ˈnoʊtɪs smɑːl saʊnd ˈtʃeɪndʒɪz/", level: "hard" },
  { text: "The university schedule changed unexpectedly this morning.", ipa: "/ðə ˌjuːnɪˈvɜːsəti ˈʃedjuːl tʃeɪndʒd ˌʌnɪkˈspektɪdli ðɪs ˈmɔːnɪŋ/", usIpa: "/ðə ˌjunəˈvɝːsəti ˈskedʒuːl tʃeɪndʒd ˌʌnɪkˈspektɪdli ðɪs ˈmɔːrnɪŋ/", level: "hard" },
  { text: "I would've practised more if I had known.", ipa: "/aɪ wʊdəv ˈpræktɪst mɔːr ɪf aɪ həd nəʊn/", usIpa: "/aɪ wʊdəv ˈpræktɪst mɔːr ɪf aɪ həd noʊn/", level: "hard" },
  { text: "The exam questions weren't as simple as expected.", ipa: "/ði ɪɡˈzæm ˈkwestʃənz wɜːnt əz ˈsɪmpəl əz ɪkˈspektɪd/", usIpa: "/ði ɪɡˈzæm ˈkwestʃənz wɝːnt əz ˈsɪmpəl əz ɪkˈspektɪd/", level: "hard" },
  { text: "Natural speech usually sounds faster than classroom practice.", ipa: "/ˈnætʃərəl spiːtʃ ˈjuːʒuəli saʊndz ˈfɑːstə ðən ˈklɑːsruːm ˈpræktɪs/", usIpa: "/ˈnætʃərəl spitʃ ˈjuʒuəli saʊndz ˈfæstər ðən ˈklæsrum ˈpræktɪs/", level: "hard" }
);

const EXTRA_TRANSCRIPTION_WORDS = [
  ["fatma", "/ˈfæt.mə/"], ["tami", "/ˈtæm.i/"], ["tammy", "/ˈtæm.i/"], ["fatima", "/ˈfæt.ɪ.mə/"],
  ["mohammed", "/məˈhæm.əd/"], ["muhammad", "/məˈhæm.əd/"], ["ahmed", "/ˈɑː.med/", "/ˈɑː.med/"], ["ali", "/ˈɑː.li/"],
  ["omar", "/ˈəʊ.mɑː/", "/ˈoʊ.mɑːr/"], ["abdullah", "/æbˈdʊl.ə/"], ["khalid", "/ˈkæl.ɪd/"], ["yousef", "/ˈjuː.səf/"],
  ["yusuf", "/ˈjuː.səf/"], ["ibrahim", "/ˌɪb.rəˈhiːm/"], ["hassan", "/ˈhæs.ən/"], ["hussein", "/hʊˈseɪn/"],
  ["salem", "/ˈsæ.ləm/"], ["saeed", "/sæˈiːd/"], ["rashid", "/ˈræʃ.ɪd/"], ["mansour", "/mænˈsʊə/", "/mænˈsʊr/"],
  ["noura", "/ˈnʊə.rə/", "/ˈnʊr.ə/"], ["nora", "/ˈnɔː.rə/"], ["maryam", "/ˈmær.i.əm/"], ["mariam", "/ˈmær.i.əm/"],
  ["aisha", "/aɪˈiː.ʃə/"], ["ayesha", "/aɪˈeɪ.ʃə/"], ["amina", "/əˈmiː.nə/"], ["reem", "/riːm/"],
  ["lama", "/ˈlɑː.mə/"], ["layla", "/ˈleɪ.lə/"], ["leila", "/ˈleɪ.lə/"], ["sara", "/ˈsɑː.rə/"], ["sarah", "/ˈseə.rə/", "/ˈser.ə/"],
  ["noor", "/nʊə/", "/nʊr/"], ["huda", "/ˈhuː.də/"], ["maha", "/ˈmɑː.hə/"], ["dana", "/ˈdæ.nə/"],
  ["maitha", "/ˈmeɪ.θə/"], ["shaikha", "/ˈʃeɪ.kə/"], ["latifa", "/ləˈtiː.fə/"], ["hind", "/hɪnd/"],
  ["zainab", "/ˈzeɪ.næb/"], ["zara", "/ˈzɑː.rə/"], ["yasmin", "/ˈjæz.mɪn/"], ["yasmeen", "/jæzˈmiːn/"],
  ["john", "/dʒɒn/", "/dʒɑːn/"], ["james", "/dʒeɪmz/"], ["robert", "/ˈrɒb.ət/", "/ˈrɑː.bɚt/"], ["michael", "/ˈmaɪ.kəl/"],
  ["william", "/ˈwɪl.i.əm/"], ["david", "/ˈdeɪ.vɪd/"], ["richard", "/ˈrɪtʃ.əd/", "/ˈrɪtʃ.ɚd/"], ["joseph", "/ˈdʒəʊ.zəf/", "/ˈdʒoʊ.zəf/"],
  ["thomas", "/ˈtɒm.əs/", "/ˈtɑː.məs/"], ["charles", "/tʃɑːlz/", "/tʃɑːrlz/"], ["daniel", "/ˈdæn.i.əl/"], ["matthew", "/ˈmæθ.juː/"],
  ["anthony", "/ˈæn.tə.ni/"], ["mark", "/mɑːk/", "/mɑːrk/"], ["paul", "/pɔːl/"], ["steven", "/ˈstiː.vən/"],
  ["andrew", "/ˈæn.druː/"], ["kevin", "/ˈkev.ɪn/"], ["brian", "/ˈbraɪ.ən/"], ["george", "/dʒɔːdʒ/", "/dʒɔːrdʒ/"],
  ["edward", "/ˈed.wəd/", "/ˈed.wɚd/"], ["ronald", "/ˈrɒn.əld/", "/ˈrɑː.nəld/"], ["tim", "/tɪm/"], ["sam", "/sæm/"],
  ["alex", "/ˈæl.eks/"], ["ben", "/ben/"], ["jack", "/dʒæk/"], ["harry", "/ˈhær.i/"], ["oliver", "/ˈɒl.ɪ.və/", "/ˈɑː.lɪ.vɚ/"],
  ["henry", "/ˈhen.ri/"], ["leo", "/ˈliː.əʊ/", "/ˈliː.oʊ/"], ["adam", "/ˈæd.əm/"], ["ryan", "/ˈraɪ.ən/"],
  ["mary", "/ˈmeə.ri/", "/ˈmer.i/"], ["patricia", "/pəˈtrɪʃ.ə/"], ["jennifer", "/ˈdʒen.ɪ.fə/", "/ˈdʒen.ə.fɚ/"], ["linda", "/ˈlɪn.də/"],
  ["elizabeth", "/ɪˈlɪz.ə.bəθ/"], ["barbara", "/ˈbɑː.bər.ə/", "/ˈbɑːr.bɚ.ə/"], ["susan", "/ˈsuː.zən/"], ["jessica", "/ˈdʒes.ɪ.kə/"],
  ["sophia", "/səˈfiː.ə/"], ["emma", "/ˈem.ə/"], ["olivia", "/əˈlɪv.i.ə/"], ["ava", "/ˈeɪ.və/"],
  ["isabella", "/ˌɪz.əˈbel.ə/"], ["mia", "/ˈmiː.ə/"], ["amelia", "/əˈmiː.li.ə/"], ["charlotte", "/ˈʃɑː.lət/", "/ˈʃɑːr.lət/"],
  ["emily", "/ˈem.əl.i/"], ["ella", "/ˈel.ə/"], ["grace", "/ɡreɪs/"], ["chloe", "/ˈkləʊ.i/", "/ˈkloʊ.i/"],
  ["lucy", "/ˈluː.si/"], ["lily", "/ˈlɪl.i/"], ["hannah", "/ˈhæn.ə/"], ["anna", "/ˈæn.ə/"], ["claire", "/kleə/", "/kler/"],
  ["shamma", "/ˈʃæm.ə/"], ["shamsa", "/ˈʃæm.sə/"], ["hamdan", "/ˈhæm.dæn/"], ["hamad", "/ˈhæm.əd/"], ["hamda", "/ˈhæm.də/"],
  ["maktoum", "/mækˈtuːm/"], ["nahyan", "/næhˈjɑːn/"], ["zayed", "/ˈzaɪ.ed/"], ["zaid", "/zeɪd/"], ["saif", "/saɪf/"],
  ["sultan", "/ˈsʌl.tən/"], ["majed", "/ˈmædʒ.ɪd/"], ["majid", "/ˈmædʒ.ɪd/"], ["marwan", "/ˈmɑː.wæn/", "/ˈmɑːr.wæn/"],
  ["maher", "/ˈmɑː.hə/", "/ˈmɑː.hɚ/"], ["tariq", "/ˈtɑː.rɪk/"], ["tareq", "/ˈtɑː.rɪk/"], ["faisal", "/ˈfaɪ.zəl/"],
  ["fahad", "/ˈfɑː.həd/"], ["fahd", "/fɑːd/"], ["nasser", "/ˈnæs.ə/", "/ˈnæs.ɚ/"], ["nasir", "/ˈnɑː.sɪr/"],
  ["salman", "/ˈsæl.mən/"], ["khalifa", "/kəˈliː.fə/"], ["mubarak", "/muːˈbɑː.ræk/"], ["jassim", "/ˈdʒæs.ɪm/"],
  ["qasim", "/ˈkɑː.sɪm/"], ["abdulaziz", "/ˌæb.dʊl.əˈziːz/"], ["abdulrahman", "/ˌæb.dʊlˈrɑː.mən/"], ["abdulrahim", "/ˌæb.dʊl.rɑːˈhiːm/"],
  ["abdulazeez", "/ˌæb.dʊl.əˈziːz/"], ["abdulaziz", "/ˌæb.dʊl.əˈziːz/"], ["abdulrahman", "/ˌæb.dʊlˈrɑː.mən/"],
  ["noora", "/ˈnʊə.rə/", "/ˈnʊr.ə/"], ["mouza", "/ˈmuː.zə/"], ["moza", "/ˈmoʊ.zə/"], ["afra", "/ˈæf.rə/"], ["alya", "/ˈæl.jə/"],
  ["alia", "/ˈɑː.li.ə/"], ["maitha", "/ˈmeɪ.θə/"], ["meera", "/ˈmɪə.rə/", "/ˈmɪr.ə/"], ["mira", "/ˈmɪə.rə/", "/ˈmɪr.ə/"],
  ["salama", "/səˈlɑː.mə/"], ["hessa", "/ˈhes.ə/"], ["hanan", "/həˈnæn/"], ["amal", "/əˈmæl/"], ["eman", "/ˈiː.mən/"],
  ["iman", "/iˈmɑːn/"], ["aya", "/ˈaɪ.ə/"], ["dalia", "/ˈdɑː.li.ə/"], ["nadia", "/ˈnɑː.di.ə/"], ["raya", "/ˈraɪ.ə/"],
  ["farah", "/ˈfær.ə/"], ["samira", "/səˈmɪə.rə/", "/səˈmɪr.ə/"], ["amira", "/əˈmɪə.rə/", "/əˈmɪr.ə/"], ["jamila", "/dʒəˈmiː.lə/"],
  ["laila", "/ˈleɪ.lə/"], ["hala", "/ˈhɑː.lə/"], ["rima", "/ˈriː.mə/"], ["safa", "/ˈsɑː.fə/"], ["wafa", "/ˈwɑː.fə/"],
  ["liam", "/ˈliː.əm/"], ["noah", "/ˈnəʊ.ə/", "/ˈnoʊ.ə/"], ["ethan", "/ˈiː.θən/"], ["logan", "/ˈləʊ.ɡən/", "/ˈloʊ.ɡən/"],
  ["lucas", "/ˈluː.kəs/"], ["mason", "/ˈmeɪ.sən/"], ["elijah", "/ɪˈlaɪ.dʒə/"], ["aiden", "/ˈeɪ.dən/"], ["jayden", "/ˈdʒeɪ.dən/"],
  ["sebastian", "/sɪˈbæs.ti.ən/"], ["carter", "/ˈkɑː.tə/", "/ˈkɑːr.t̬ɚ/"], ["wyatt", "/ˈwaɪ.ət/"], ["dylan", "/ˈdɪl.ən/"], ["owen", "/ˈəʊ.ən/", "/ˈoʊ.ən/"],
  ["zoe", "/ˈzəʊ.i/", "/ˈzoʊ.i/"], ["zoey", "/ˈzəʊ.i/", "/ˈzoʊ.i/"], ["madison", "/ˈmæd.ɪ.sən/"], ["abigail", "/ˈæb.ɪ.ɡeɪl/"],
  ["scarlett", "/ˈskɑː.lət/", "/ˈskɑːr.lət/"], ["victoria", "/vɪkˈtɔː.ri.ə/"], ["aria", "/ˈɑː.ri.ə/"], ["layla", "/ˈleɪ.lə/"],
  ["natalie", "/ˈnæt.əl.i/"], ["brooklyn", "/ˈbrʊk.lɪn/"], ["savannah", "/səˈvæn.ə/"], ["audrey", "/ˈɔː.dri/"], ["allison", "/ˈæl.ɪ.sən/"],
  ["nino", "/ˈniː.noʊ/"], ["giorgi", "/ˈɡjɔːr.ɡi/"], ["davit", "/ˈdɑː.vɪt/"], ["irakli", "/ɪˈrɑː.kli/"], ["levan", "/ˈle.vɑːn/"],
  ["nika", "/ˈniː.kə/"], ["luka", "/ˈluː.kə/"], ["tamar", "/ˈtɑː.mɑː/", "/ˈtɑː.mɑːr/"], ["nana", "/ˈnɑː.nə/"], ["nino", "/ˈniː.noʊ/"],
  ["ana", "/ˈɑː.nə/"], ["mariam", "/ˈmær.i.əm/"], ["keti", "/ˈket.i/"], ["salome", "/səˈloʊ.meɪ/"], ["elene", "/ˈel.ə.neɪ/"],
  ["kwame", "/ˈkwɑː.meɪ/"], ["kofi", "/ˈkoʊ.fi/"], ["kwesi", "/ˈkweɪ.si/"], ["ama", "/ˈɑː.mə/"], ["akua", "/əˈkuː.ə/"],
  ["abena", "/əˈbeɪ.nə/"], ["amina", "/əˈmiː.nə/"], ["aminata", "/ˌæm.ɪˈnɑː.tə/"], ["fatou", "/ˈfɑː.tuː/"], ["mariam", "/ˈmær.i.əm/"],
  ["moussa", "/ˈmuː.sə/"], ["musa", "/ˈmuː.sə/"], ["ibrahima", "/ˌɪb.rəˈhiː.mə/"], ["cheikh", "/ʃeɪk/"], ["amadou", "/ˈæm.ə.duː/"],
  ["aissatou", "/ˌaɪ.səˈtuː/"], ["zola", "/ˈzoʊ.lə/"], ["thabo", "/ˈtɑː.boʊ/"], ["sipho", "/ˈsiː.poʊ/"], ["nomsa", "/ˈnɒm.sə/", "/ˈnɑːm.sə/"],
  ["lerato", "/leˈrɑː.toʊ/"], ["anele", "/əˈneɪ.leɪ/"], ["tendai", "/tenˈdaɪ/"], ["chipo", "/ˈtʃiː.poʊ/"], ["takudzwa", "/tɑːˈkuːdz.wə/"],
  ["ngozi", "/ənˈɡoʊ.zi/"], ["chioma", "/tʃiˈoʊ.mə/"], ["chinedu", "/tʃɪˈneɪ.duː/"], ["ifeoma", "/ɪf.iˈoʊ.mə/"], ["olumide", "/oʊ.luːˈmiː.deɪ/"],
  ["adewale", "/ˌæd.eɪˈwɑː.leɪ/"], ["temitope", "/ˌtem.ɪˈtoʊ.peɪ/"], ["ayodele", "/ˌaɪ.oʊˈdeɪ.leɪ/"], ["wambui", "/wɑːmˈbuː.i/"], ["wanjiku", "/wɑːnˈdʒiː.kuː/"],
  ["kenji", "/ˈken.dʒi/"], ["hiroshi", "/hɪˈroʊ.ʃi/"], ["takashi", "/təˈkɑː.ʃi/"], ["yuki", "/ˈjuː.ki/"], ["haruto", "/hɑːˈruː.toʊ/"],
  ["ren", "/ren/"], ["sota", "/ˈsoʊ.tə/"], ["daiki", "/ˈdaɪ.ki/"], ["naoki", "/naɪˈoʊ.ki/"], ["akira", "/əˈkɪə.rə/", "/əˈkɪr.ə/"],
  ["sakura", "/səˈkʊə.rə/", "/səˈkʊr.ə/"], ["hana", "/ˈhɑː.nə/"], ["yuna", "/ˈjuː.nə/"], ["aiko", "/ˈaɪ.koʊ/"], ["mei", "/meɪ/"],
  ["rin", "/rɪn/"], ["kaori", "/kaʊˈriː/"], ["miyu", "/ˈmiː.juː/"], ["emiko", "/ˈem.ɪ.koʊ/"], ["nanami", "/nəˈnɑː.mi/"],
  ["wei", "/weɪ/"], ["li", "/liː/"], ["wang", "/wɑːŋ/"], ["zhang", "/dʒɑːŋ/"], ["liu", "/ljuː/"], ["chen", "/tʃen/"],
  ["yang", "/jɑːŋ/"], ["huang", "/hwɑːŋ/"], ["zhao", "/dʒaʊ/"], ["wu", "/wuː/"], ["xu", "/ʃuː/"], ["sun", "/sʌn/"],
  ["xiao", "/ʃaʊ/"], ["ming", "/mɪŋ/"], ["jun", "/dʒʊn/"], ["hao", "/haʊ/"], ["lin", "/lɪn/"], ["mei", "/meɪ/"],
  ["lihua", "/ˈliː.hwɑː/"], ["xiaoming", "/ʃaʊˈmɪŋ/"], ["ying", "/jɪŋ/"], ["yue", "/juːˈeɪ/"], ["lan", "/læn/"], ["fang", "/fɑːŋ/"],
  ["minjun", "/ˈmɪn.dʒuːn/"], ["jiho", "/ˈdʒiː.hoʊ/"], ["seojoon", "/ˈsʌ.dʒuːn/"], ["seojun", "/ˈsʌ.dʒuːn/"], ["do-yun", "/ˈdoʊ.juːn/"],
  ["doyun", "/ˈdoʊ.juːn/"], ["hyunwoo", "/ˈhjʌn.wuː/"], ["minseo", "/ˈmɪn.soʊ/"], ["jiwoo", "/ˈdʒiː.wuː/"], ["seoyeon", "/ˈsʌ.jʌn/"],
  ["hajun", "/ˈhɑː.dʒuːn/"], ["jimin", "/ˈdʒiː.mɪn/"], ["jiyoon", "/ˈdʒiː.juːn/"], ["sumin", "/ˈsuː.mɪn/"], ["haneul", "/hɑːˈnʌl/"],
  ["minji", "/ˈmɪn.dʒi/"], ["eunji", "/ˈʊn.dʒi/"], ["taehyung", "/ˈteɪ.hjʌŋ/"], ["seungmin", "/ˈsʊŋ.mɪn/"], ["jisoo", "/ˈdʒiː.suː/"],
  ["miguel", "/mɪˈɡel/"], ["carlos", "/ˈkɑː.lɒs/", "/ˈkɑːr.loʊs/"], ["juan", "/hwɑːn/"], ["diego", "/diˈeɪ.ɡoʊ/"], ["sofia", "/səˈfiː.ə/"],
  ["camila", "/kəˈmiː.lə/"], ["valentina", "/ˌvæl.ənˈtiː.nə/"], ["lucia", "/luːˈsiː.ə/"], ["mateo", "/məˈteɪ.oʊ/"], ["santiago", "/ˌsæn.tiˈɑː.ɡoʊ/"],
  ["giulia", "/ˈdʒuː.li.ə/"], ["giovanni", "/dʒoʊˈvɑː.ni/"], ["francesca", "/frænˈtʃes.kə/"], ["luca", "/ˈluː.kə/"], ["matteo", "/məˈteɪ.oʊ/"],
  ["pierre", "/piˈeə/", "/piˈer/"], ["antoine", "/ænˈtwɑːn/"], ["amelie", "/ˈæm.ə.li/"], ["chloe", "/ˈkləʊ.i/", "/ˈkloʊ.i/"], ["ines", "/ɪˈnes/"],
  ["hans", "/hæns/"], ["klaus", "/klaʊs/"], ["lena", "/ˈleɪ.nə/"], ["greta", "/ˈɡreɪ.tə/"], ["freya", "/ˈfreɪ.ə/"],
  ["ivan", "/ˈaɪ.vən/"], ["dmitri", "/ˈdmiː.tri/"], ["natalia", "/nəˈtɑː.li.ə/"], ["anastasia", "/ˌæn.əˈsteɪ.ʒə/"], ["olga", "/ˈɒl.ɡə/", "/ˈɑːl.ɡə/"],
  ["at", "/æt/"], ["sky", "/skaɪ/"], ["look", "/lʊk/"], ["looks", "/lʊks/"], ["looked", "/lʊkt/"], ["looking", "/ˈlʊk.ɪŋ/"],
  ["book", "/bʊk/"], ["books", "/bʊks/"], ["cat", "/kæt/"], ["cats", "/kæts/"], ["dog", "/dɒɡ/", "/dɑːɡ/"],
  ["boy", "/bɔɪ/"], ["girl", "/ɡɜːl/", "/ɡɝːl/"], ["baby", "/ˈbeɪ.bi/"], ["person", "/ˈpɜː.sən/", "/ˈpɝː.sən/"], ["people", "/ˈpiː.pəl/"],
  ["man", "/mæn/"], ["men", "/men/"], ["woman", "/ˈwʊm.ən/"], ["women", "/ˈwɪm.ɪn/"],
  ["child", "/tʃaɪld/"], ["children", "/ˈtʃɪl.drən/"], ["friend", "/frend/"], ["friends", "/frendz/"],
  ["love", "/lʌv/"], ["life", "/laɪf/"], ["live", "/lɪv/"], ["help", "/help/"], ["use", "/juːz/"], ["used", "/juːzd/"], ["try", "/traɪ/"],
  ["start", "/stɑːt/", "/stɑːrt/"], ["stop", "/stɒp/", "/stɑːp/"], ["finish", "/ˈfɪn.ɪʃ/"], ["change", "/tʃeɪndʒ/"], ["move", "/muːv/"],
  ["bring", "/brɪŋ/"], ["buy", "/baɪ/"], ["bought", "/bɔːt/", "/bɑːt/"], ["sell", "/sel/"], ["pay", "/peɪ/"], ["find", "/faɪnd/"],
  ["leave", "/liːv/"], ["left", "/left/"], ["meet", "/miːt/"], ["met", "/met/"], ["call", "/kɔːl/"], ["wait", "/weɪt/"],
  ["hello", "/həˈləʊ/", "/həˈloʊ/"], ["world", "/wɜːld/", "/wɝːld/"], ["english", "/ˈɪŋ.ɡlɪʃ/"],
  ["language", "/ˈlæŋ.ɡwɪdʒ/"], ["word", "/wɜːd/", "/wɝːd/"], ["words", "/wɜːdz/", "/wɝːdz/"],
  ["sentence", "/ˈsen.təns/"], ["question", "/ˈkwes.tʃən/"], ["answer", "/ˈɑːn.sə/", "/ˈæn.sɚ/"],
  ["write", "/raɪt/"], ["read", "/riːd/"], ["listen", "/ˈlɪs.ən/"], ["hear", "/hɪə/", "/hɪr/"],
  ["say", "/seɪ/"], ["said", "/sed/"], ["tell", "/tel/"], ["talk", "/tɔːk/", "/tɑːk/"],
  ["speak", "/spiːk/"], ["study", "/ˈstʌd.i/"], ["student", "/ˈstjuː.dənt/", "/ˈstuː.dənt/"],
  ["teacher", "/ˈtiː.tʃə/", "/ˈtiː.tʃɚ/"], ["class", "/klɑːs/", "/klæs/"], ["lesson", "/ˈles.ən/"],
  ["test", "/test/"], ["exam", "/ɪɡˈzæm/"], ["page", "/peɪdʒ/"], ["paper", "/ˈpeɪ.pə/", "/ˈpeɪ.pɚ/"], ["pen", "/pen/"], ["pencil", "/ˈpen.səl/"],
  ["school", "/skuːl/"], ["college", "/ˈkɒl.ɪdʒ/", "/ˈkɑː.lɪdʒ/"], ["university", "/ˌjuː.nɪˈvɜː.sə.ti/", "/ˌjuː.nəˈvɝː.sə.t̬i/"],
  ["good", "/ɡʊd/"], ["bad", "/bæd/"], ["best", "/best/"], ["better", "/ˈbet.ə/", "/ˈbet̬.ɚ/"], ["great", "/ɡreɪt/"], ["small", "/smɔːl/", "/smɑːl/"],
  ["big", "/bɪɡ/"], ["old", "/əʊld/", "/oʊld/"], ["young", "/jʌŋ/"], ["new", "/njuː/", "/nuː/"],
  ["beautiful", "/ˈbjuː.tɪ.fəl/"], ["nice", "/naɪs/"], ["important", "/ɪmˈpɔː.tənt/", "/ɪmˈpɔːr.tənt/"], ["different", "/ˈdɪf.ər.ənt/"],
  ["same", "/seɪm/"], ["right", "/raɪt/"], ["wrong", "/rɒŋ/", "/rɔːŋ/"], ["possible", "/ˈpɒs.ə.bəl/", "/ˈpɑː.sə.bəl/"], ["easy", "/ˈiː.zi/"], ["hard", "/hɑːd/", "/hɑːrd/"],
  ["first", "/fɜːst/", "/fɝːst/"], ["last", "/lɑːst/", "/læst/"], ["next", "/nekst/"], ["early", "/ˈɜː.li/", "/ˈɝː.li/"], ["late", "/leɪt/"],
  ["today", "/təˈdeɪ/"], ["tomorrow", "/təˈmɒr.əʊ/", "/təˈmɑːr.oʊ/"], ["yesterday", "/ˈjes.tə.deɪ/"],
  ["week", "/wiːk/"], ["month", "/mʌnθ/"], ["year", "/jɪə/", "/jɪr/"], ["morning", "/ˈmɔː.nɪŋ/", "/ˈmɔːr.nɪŋ/"], ["afternoon", "/ˌɑːf.təˈnuːn/", "/ˌæf.tɚˈnuːn/"],
  ["evening", "/ˈiːv.nɪŋ/"], ["night", "/naɪt/"], ["day", "/deɪ/"], ["time", "/taɪm/"],
  ["now", "/naʊ/"], ["then", "/ðen/"], ["again", "/əˈɡen/"], ["always", "/ˈɔːl.weɪz/"], ["never", "/ˈnev.ə/", "/ˈnev.ɚ/"],
  ["sometimes", "/ˈsʌm.taɪmz/"], ["often", "/ˈɒf.ən/", "/ˈɑːf.ən/"], ["here", "/hɪə/", "/hɪr/"], ["there", "/ðeə/", "/ðer/"],
  ["where", "/weə/", "/wer/"], ["what", "/wɒt/", "/wʌt/"], ["when", "/wen/"], ["why", "/waɪ/"],
  ["how", "/haʊ/"], ["who", "/huː/"], ["which", "/wɪtʃ/"], ["yes", "/jes/"], ["no", "/nəʊ/", "/noʊ/"],
  ["please", "/pliːz/"], ["thank", "/θæŋk/"], ["thanks", "/θæŋks/"], ["sorry", "/ˈsɒr.i/", "/ˈsɑːr.i/"],
  ["house", "/haʊs/"], ["home", "/həʊm/", "/hoʊm/"], ["room", "/ruːm/"], ["bed", "/bed/"], ["bathroom", "/ˈbɑːθ.ruːm/", "/ˈbæθ.ruːm/"],
  ["kitchen", "/ˈkɪtʃ.ən/"], ["door", "/dɔː/", "/dɔːr/"], ["floor", "/flɔː/", "/flɔːr/"], ["wall", "/wɔːl/", "/wɑːl/"],
  ["window", "/ˈwɪn.dəʊ/", "/ˈwɪn.doʊ/"], ["table", "/ˈteɪ.bəl/"], ["chair", "/tʃeə/", "/tʃer/"],
  ["water", "/ˈwɔː.tə/", "/ˈwɑː.t̬ɚ/"], ["food", "/fuːd/"], ["bread", "/bred/"], ["rice", "/raɪs/"], ["milk", "/mɪlk/"],
  ["tea", "/tiː/"], ["coffee", "/ˈkɒf.i/", "/ˈkɑː.fi/"], ["breakfast", "/ˈbrek.fəst/"], ["lunch", "/lʌntʃ/"], ["dinner", "/ˈdɪn.ə/", "/ˈdɪn.ɚ/"],
  ["phone", "/fəʊn/", "/foʊn/"], ["computer", "/kəmˈpjuː.tə/", "/kəmˈpjuː.t̬ɚ/"], ["internet", "/ˈɪn.tə.net/", "/ˈɪn.t̬ɚ.net/"],
  ["music", "/ˈmjuː.zɪk/"], ["movie", "/ˈmuː.vi/"], ["video", "/ˈvɪd.i.əʊ/", "/ˈvɪd.i.oʊ/"],
  ["family", "/ˈfæm.əl.i/"], ["parent", "/ˈpeə.rənt/", "/ˈper.ənt/"], ["mother", "/ˈmʌð.ə/", "/ˈmʌð.ɚ/"], ["father", "/ˈfɑː.ðə/", "/ˈfɑː.ðɚ/"],
  ["brother", "/ˈbrʌð.ə/", "/ˈbrʌð.ɚ/"], ["sister", "/ˈsɪs.tə/", "/ˈsɪs.tɚ/"],
  ["go", "/ɡəʊ/", "/ɡoʊ/"], ["went", "/went/"], ["come", "/kʌm/"], ["came", "/keɪm/"], ["want", "/wɒnt/", "/wɑːnt/"], ["need", "/niːd/"],
  ["like", "/laɪk/"], ["make", "/meɪk/"], ["take", "/teɪk/"], ["give", "/ɡɪv/"], ["get", "/ɡet/"],
  ["put", "/pʊt/"], ["keep", "/kiːp/"], ["let", "/let/"], ["ask", "/ɑːsk/", "/æsk/"], ["answer", "/ˈɑːn.sə/", "/ˈæn.sɚ/"],
  ["see", "/siː/"], ["saw", "/sɔː/", "/sɑː/"], ["watch", "/wɒtʃ/", "/wɑːtʃ/"], ["open", "/ˈəʊ.pən/", "/ˈoʊ.pən/"], ["close", "/kləʊz/", "/kloʊz/"],
  ["work", "/wɜːk/", "/wɝːk/"], ["play", "/pleɪ/"], ["learn", "/lɜːn/", "/lɝːn/"], ["remember", "/rɪˈmem.bə/", "/rɪˈmem.bɚ/"],
  ["forget", "/fəˈɡet/", "/fɚˈɡet/"], ["understand", "/ˌʌn.dəˈstænd/", "/ˌʌn.dɚˈstænd/"], ["think", "/θɪŋk/"], ["know", "/nəʊ/", "/noʊ/"],
  ["walk", "/wɔːk/", "/wɑːk/"], ["run", "/rʌn/"], ["sit", "/sɪt/"], ["stand", "/stænd/"],
  ["drive", "/draɪv/"], ["ride", "/raɪd/"], ["travel", "/ˈtræv.əl/"], ["arrive", "/əˈraɪv/"], ["stay", "/steɪ/"],
  ["happy", "/ˈhæp.i/"], ["sad", "/sæd/"], ["angry", "/ˈæŋ.ɡri/"], ["tired", "/taɪəd/", "/taɪrd/"], ["hungry", "/ˈhʌŋ.ɡri/"],
  ["hot", "/hɒt/", "/hɑːt/"], ["cold", "/kəʊld/", "/koʊld/"], ["warm", "/wɔːm/", "/wɔːrm/"], ["fresh", "/freʃ/"], ["air", "/eə/", "/er/"],
  ["sun", "/sʌn/"], ["moon", "/muːn/"], ["star", "/stɑː/", "/stɑːr/"], ["rain", "/reɪn/"], ["wind", "/wɪnd/"], ["sea", "/siː/"], ["tree", "/triː/"],
  ["city", "/ˈsɪt.i/"], ["street", "/striːt/"], ["car", "/kɑː/", "/kɑːr/"], ["bus", "/bʌs/"], ["train", "/treɪn/"], ["station", "/ˈsteɪ.ʃən/"], ["shop", "/ʃɒp/", "/ʃɑːp/"]
];

const PROVIDED_WORDS_TEXT = `
about|/əˈbaʊt/|/əˈbaʊt/
above|/əˈbʌv/|/əˈbʌv/
accept|/əkˈsept/|/əkˈsept/
across|/əˈkrɒs/|/əˈkrɔːs/
action|/ˈækʃən/|/ˈækʃən/
active|/ˈæktɪv/|/ˈæktɪv/
actor|/ˈæktə/|/ˈæktər/
add|/æd/|/æd/
address|/ˈædres/|/ˈædres/
after|/ˈɑːftə/|/ˈæftər/
again|/əˈɡen/|/əˈɡɛn/
age|/eɪdʒ/|/eɪdʒ/
air|/eə/|/er/
allow|/əˈlaʊ/|/əˈlaʊ/
almost|/ˈɔːlməʊst/|/ˈɔːlmoʊst/
alone|/əˈləʊn/|/əˈloʊn/
along|/əˈlɒŋ/|/əˈlɔːŋ/
already|/ɔːlˈredi/|/ɔːlˈredi/
also|/ˈɔːlsəʊ/|/ˈɔːlsoʊ/
always|/ˈɔːlweɪz/|/ˈɔːlweɪz/
animal|/ˈænɪməl/|/ˈænɪməl/
answer|/ˈɑːnsə/|/ˈænsər/
appear|/əˈpɪə/|/əˈpɪr/
apply|/əˈplaɪ/|/əˈplaɪ/
area|/ˈeəriə/|/ˈeriə/
arrive|/əˈraɪv/|/əˈraɪv/
ask|/ɑːsk/|/æsk/
attack|/əˈtæk/|/əˈtæk/
attempt|/əˈtempt/|/əˈtempt/
attention|/əˈtenʃən/|/əˈtenʃən/
author|/ˈɔːθə/|/ˈɔːθər/
available|/əˈveɪləbl/|/əˈveɪləbl/
avoid|/əˈvɔɪd/|/əˈvɔɪd/
back|/bæk/|/bæk/
bag|/bæɡ/|/bæɡ/
ball|/bɔːl/|/bɔl/
bank|/bæŋk/|/bæŋk/
bar|/bɑː/|/bɑr/
base|/beɪs/|/beɪs/
basic|/ˈbeɪsɪk/|/ˈbeɪsɪk/
basket|/ˈbɑːskɪt/|/ˈbæskɪt/
bath|/bɑːθ/|/bæθ/
battle|/ˈbætl/|/ˈbætl/
be|/biː/|/bi/
beach|/biːtʃ/|/biːtʃ/
beam|/biːm/|/biːm/
bean|/biːn/|/biːn/
bear|/beə/|/ber/
beat|/biːt/|/biːt/
because|/bɪˈkɒz/|/bɪˈkɔz/
become|/bɪˈkʌm/|/bɪˈkʌm/
before|/bɪˈfɔː/|/bɪˈfɔr/
begin|/bɪˈɡɪn/|/bɪˈɡɪn/
behind|/bɪˈhaɪnd/|/bɪˈhaɪnd/
believe|/bɪˈliːv/|/bɪˈliv/
bell|/bel/|/bel/
belong|/bɪˈlɒŋ/|/bɪˈlɔŋ/
below|/bɪˈləʊ/|/bɪˈloʊ/
belt|/belt/|/belt/
bench|/bentʃ/|/bentʃ/
bend|/bend/|/bend/
benefit|/ˈbenɪfɪt/|/ˈbenəfɪt/
between|/bɪˈtwiːn/|/bɪˈtwin/
bill|/bɪl/|/bɪl/
bird|/bɜːd/|/bɝd/
birth|/bɜːθ/|/bɝθ/
bit|/bɪt/|/bɪt/
bite|/baɪt/|/baɪt/
black|/blæk/|/blæk/
blade|/bleɪd/|/bleɪd/
blame|/bleɪm/|/bleɪm/
blank|/blæŋk/|/blæŋk/
blind|/blaɪnd/|/blaɪnd/
block|/blɒk/|/blɑk/
blue|/bluː/|/blu/
board|/bɔːd/|/bɔrd/
boat|/bəʊt/|/boʊt/
body|/ˈbɒdi/|/ˈbɑdi/
boot|/buːt/|/but/
born|/bɔːn/|/bɔrn/
borrow|/ˈbɒrəʊ/|/ˈbɑroʊ/
both|/bəʊθ/|/boʊθ/
bottle|/ˈbɒtl/|/ˈbɑtl/
bottom|/ˈbɒtəm/|/ˈbɑtəm/
box|/bɒks/|/bɑks/
brain|/breɪn/|/breɪn/
branch|/brɑːntʃ/|/bræntʃ/
brave|/breɪv/|/breɪv/
break|/breɪk/|/breɪk/
breath|/breθ/|/breθ/
brick|/brɪk/|/brɪk/
bridge|/brɪdʒ/|/brɪdʒ/
bright|/braɪt/|/braɪt/
broad|/brɔːd/|/brɔd/
build|/bɪld/|/bɪld/
burn|/bɜːn/|/bɝn/
business|/ˈbɪznəs/|/ˈbɪznəs/
busy|/ˈbɪzi/|/ˈbɪzi/
but|/bʌt/|/bʌt/
button|/ˈbʌtn/|/ˈbʌtn/
buy|/baɪ/|/baɪ/
by|/baɪ/|/baɪ/
cabin|/ˈkæbɪn/|/ˈkæbɪn/
cable|/ˈkeɪbl/|/ˈkeɪbəl/
cake|/keɪk/|/keɪk/
calm|/kɑːm/|/kɑm/
camera|/ˈkæmərə/|/ˈkæmərə/
camp|/kæmp/|/kæmp/
can|/kæn/|/kæn/
cancel|/ˈkænsəl/|/ˈkænsəl/
cancer|/ˈkænsə/|/ˈkænsər/
candidate|/ˈkændɪdət/|/ˈkændəˌdeɪt/
capital|/ˈkæpɪtəl/|/ˈkæpɪtəl/
captain|/ˈkæptɪn/|/ˈkæptən/
card|/kɑːd/|/kɑrd/
care|/keə/|/ker/
career|/kəˈrɪə/|/kəˈrɪr/
careful|/ˈkeəfəl/|/ˈkerfəl/
carry|/ˈkæri/|/ˈkæri/
case|/keɪs/|/keɪs/
cash|/kæʃ/|/kæʃ/
catch|/kætʃ/|/kætʃ/
cause|/kɔːz/|/kɔz/
ceiling|/ˈsiːlɪŋ/|/ˈsiːlɪŋ/
center|/ˈsentə/|/ˈsentər/
central|/ˈsentrəl/|/ˈsentrəl/
century|/ˈsentʃəri/|/ˈsentʃəri/
certain|/ˈsɜːtən/|/ˈsɝtən/
chance|/tʃɑːns/|/tʃæns/
channel|/ˈtʃænəl/|/ˈtʃænəl/
chapter|/ˈtʃæptə/|/ˈtʃæptər/
charge|/tʃɑːdʒ/|/tʃɑrdʒ/
chart|/tʃɑːt/|/tʃɑrt/
check|/tʃek/|/tʃek/
cheese|/tʃiːz/|/tʃiz/
chemical|/ˈkemɪkəl/|/ˈkemɪkəl/
chest|/tʃest/|/tʃest/
chicken|/ˈtʃɪkɪn/|/ˈtʃɪkɪn/
choice|/tʃɔɪs/|/tʃɔɪs/
choose|/tʃuːz/|/tʃuz/
church|/tʃɜːtʃ/|/tʃɝtʃ/
circle|/ˈsɜːkl/|/ˈsɝkəl/
civil|/ˈsɪvəl/|/ˈsɪvəl/
claim|/kleɪm/|/kleɪm/
clean|/kliːn/|/klin/
clear|/klɪə/|/klɪr/
climb|/klaɪm/|/klaɪm/
clock|/klɒk/|/klɑk/
cloth|/klɒθ/|/klɔθ/
cloud|/klaʊd/|/klaʊd/
club|/klʌb/|/klʌb/
coach|/kəʊtʃ/|/koʊtʃ/
coal|/kəʊl/|/koʊl/
coast|/kəʊst/|/koʊst/
coat|/kəʊt/|/koʊt/
collect|/kəˈlekt/|/kəˈlekt/
college|/ˈkɒlɪdʒ/|/ˈkɑlɪdʒ/
colour|/ˈkʌlə/|/ˈkʌlər/
comfort|/ˈkʌmfət/|/ˈkʌmfərt/
command|/kəˈmɑːnd/|/kəˈmænd/
comment|/ˈkɒment/|/ˈkɑment/
common|/ˈkɒmən/|/ˈkɑmən/
company|/ˈkʌmpəni/|/ˈkʌmpəni/
compare|/kəmˈpeə/|/kəmˈper/
complete|/kəmˈpliːt/|/kəmˈplit/
concern|/kənˈsɜːn/|/kənˈsɝn/
condition|/kənˈdɪʃən/|/kənˈdɪʃən/
conference|/ˈkɒnfərəns/|/ˈkɑnfərəns/
connect|/kəˈnekt/|/kəˈnekt/
consider|/kənˈsɪdə/|/kənˈsɪdər/
control|/kənˈtrəʊl/|/kənˈtroʊl/
cook|/kʊk/|/kʊk/
cool|/kuːl/|/kul/
copy|/ˈkɒpi/|/ˈkɑpi/
corner|/ˈkɔːnə/|/ˈkɔrnər/
correct|/kəˈrekt/|/kəˈrekt/
cost|/kɒst/|/kɔst/
cotton|/ˈkɒtən/|/ˈkɑtən/
cough|/kɒf/|/kɔf/
could|/kʊd/|/kʊd/
country|/ˈkʌntri/|/ˈkʌntri/
course|/kɔːs/|/kɔrs/
court|/kɔːt/|/kɔrt/
cover|/ˈkʌvə/|/ˈkʌvər/
create|/kriːˈeɪt/|/kriˈeɪt/
crime|/kraɪm/|/kraɪm/
cross|/krɒs/|/krɔs/
crowd|/kraʊd/|/kraʊd/
culture|/ˈkʌltʃə/|/ˈkʌltʃər/
cup|/kʌp/|/kʌp/
current|/ˈkʌrənt/|/ˈkɝənt/
customer|/ˈkʌstəmə/|/ˈkʌstəmər/
cut|/kʌt/|/kʌt/
cycle|/ˈsaɪkl/|/ˈsaɪkəl/
each|/iːtʃ/|/itʃ/
early|/ˈɜːli/|/ˈɝli/
earn|/ɜːn/|/ɝn/
earth|/ɜːθ/|/ɝθ/
east|/iːst/|/ist/
eat|/iːt/|/it/
edge|/edʒ/|/edʒ/
education|/ˌedjuˈkeɪʃən/|/ˌedʒuˈkeɪʃən/
effect|/ɪˈfekt/|/ɪˈfekt/
effort|/ˈefət/|/ˈefərt/
eight|/eɪt/|/eɪt/
either|/ˈaɪðə/|/ˈiðər/
elder|/ˈeldə/|/ˈeldər/
electric|/ɪˈlektrɪk/|/ɪˈlektrɪk/
element|/ˈelɪmənt/|/ˈeləmənt/
else|/els/|/els/
email|/ˈiːmeɪl/|/ˈimeɪl/
employee|/ˌemplɔɪˈiː/|/ˌemplɔɪˈi/
empty|/ˈempti/|/ˈempti/
enable|/ɪˈneɪbl/|/ɪˈneɪbəl/
encourage|/ɪnˈkʌrɪdʒ/|/ɪnˈkɝɪdʒ/
end|/end/|/end/
energy|/ˈenədʒi/|/ˈenɚdʒi/
engine|/ˈendʒɪn/|/ˈendʒɪn/
enjoy|/ɪnˈdʒɔɪ/|/ɪnˈdʒɔɪ/
enough|/ɪˈnʌf/|/ɪˈnʌf/
enter|/ˈentə/|/ˈentər/
entire|/ɪnˈtaɪə/|/ɪnˈtaɪr/
environment|/ɪnˈvaɪrənmənt/|/ɪnˈvaɪrənmənt/
equal|/ˈiːkwəl/|/ˈikwəl/
equipment|/ɪˈkwɪpmənt/|/ɪˈkwɪpmənt/
error|/ˈerə/|/ˈerər/
escape|/ɪˈskeɪp/|/ɪˈskeɪp/
especially|/ɪˈspeʃəli/|/ɪˈspeʃəli/
essential|/ɪˈsenʃəl/|/ɪˈsenʃəl/
establish|/ɪˈstæblɪʃ/|/ɪˈstæblɪʃ/
even|/ˈiːvən/|/ˈivən/
event|/ɪˈvent/|/ɪˈvent/
ever|/ˈevə/|/ˈevər/
every|/ˈevri/|/ˈevri/
evidence|/ˈevɪdəns/|/ˈevɪdəns/
exact|/ɪɡˈzækt/|/ɪɡˈzækt/
example|/ɪɡˈzɑːmpl/|/ɪɡˈzæmpəl/
excellent|/ˈeksələnt/|/ˈeksələnt/
except|/ɪkˈsept/|/ɪkˈsept/
exchange|/ɪksˈtʃeɪndʒ/|/ɪksˈtʃeɪndʒ/
excite|/ɪkˈsaɪt/|/ɪkˈsaɪt/
excuse|/ɪkˈskjuːz/|/ɪkˈskjuz/
exercise|/ˈeksəsaɪz/|/ˈeksərsaɪz/
exist|/ɪɡˈzɪst/|/ɪɡˈzɪst/
expect|/ɪkˈspekt/|/ɪkˈspekt/
expense|/ɪkˈspens/|/ɪkˈspens/
experience|/ɪkˈspɪəriəns/|/ɪkˈspɪriəns/
expert|/ˈekspɜːt/|/ˈekspɝt/
explain|/ɪkˈspleɪn/|/ɪkˈspleɪn/
express|/ɪkˈspres/|/ɪkˈspres/
extend|/ɪkˈstend/|/ɪkˈstend/
extra|/ˈekstrə/|/ˈekstrə/
eye|/aɪ/|/aɪ/
`;

const GUIDES = {
  wordToIpa: {
    title: "Word to IPA",
    text: "Look at the English word and type its pronunciation in the selected accent. Use the IPA keyboard below the answer box for symbols you do not have on your normal keyboard. Slashes are optional.",
    example: "shirt → /ʃɜːt/"
  },
  ipaToWord: {
    title: "IPA to Word",
    text: "Read the IPA and type the ordinary English spelling. This trains recognition, so you do not need to type IPA symbols in this mode.",
    example: "/fəˈnet.ɪks/ → phonetics"
  },
  sentenceToIpa: {
    title: "Sentence to IPA",
    text: "Transcribe the full sentence in the selected accent. Focus on word stress, weak forms, and spacing between words. Slashes are optional.",
    example: "I love you. → /aɪ ˈlʌv juː/"
  },
  ipaToSentence: {
    title: "IPA Sentence to English",
    text: "Read the IPA sentence and type the English sentence. Punctuation and capital letters are not important.",
    example: "/aɪ hæv ə dɒɡ/ → I have a dog."
  },
  syllabification: {
    title: "Syllabification",
    text: "Syllabification is done on IPA, not spelling. First transcribe the word into IPA. Then divide the IPA into syllables using dots (.) only. Slashes and spaces are optional.\n\nExample:\nWord: beautiful\nIPA: ˈbjuːtɪfəl\nSyllabified: ˈbjuː.tɪ.fəl",
    example: "beautiful → ˈbjuːtɪfəl → ˈbjuː.tɪ.fəl"
  },
  stress: {
    title: "Stress",
    text: "Type the number of the syllable that carries the main stress. Count syllables from left to right. The stressed syllable is usually louder, longer, and clearer.",
    example: "banana → ba-NA-na, so the answer is 2"
  },
  phonemeDescription: {
    title: "Phoneme Description",
    text: "Practise describing phonemes. In symbol-to-description mode, choose the features. In description-to-symbol mode, type the IPA symbol.",
    example: "/p/ → bilabial, plosive, voiceless"
  }
};

const modeSelect = document.querySelector("#mode");
const accentSelect = document.querySelector("#accent");
const levelSelect = document.querySelector("#level");
const newQuestionButton = document.querySelector("#newQuestion");
const resetProgressButton = document.querySelector("#resetProgress");
const answerForm = document.querySelector("#answerForm");
const answerInput = document.querySelector("#answerInput");
const submitAnswer = document.querySelector("#submitAnswer");
const answerLabel = document.querySelector("#answerLabel");
const typingArea = document.querySelector("#typingArea");
const choiceArea = document.querySelector("#choiceArea");
const taskLabel = document.querySelector("#taskLabel");
const promptBox = document.querySelector("#prompt");
const questionHint = document.querySelector("#questionHint");
const feedback = document.querySelector("#feedback");
const scoreBox = document.querySelector("#score");
const accuracyBox = document.querySelector("#accuracy");
const ipaKeyboard = document.querySelector("#ipaKeyboard");
const ipaKeys = document.querySelector("#ipaKeys");
const guideTitle = document.querySelector("#guideTitle");
const guideText = document.querySelector("#guideText");
const guideExample = document.querySelector("#guideExample");
const playPracticeAudio = document.querySelector("#playPracticeAudio");
const practiceVoiceSelect = document.querySelector("#practiceVoiceSelect");
const practiceSpeechRate = document.querySelector("#practiceSpeechRate");
const practiceRateValue = document.querySelector("#practiceRateValue");
const tabButtons = document.querySelectorAll(".tab-button");
const appSections = document.querySelectorAll(".app-section");
const englishText = document.querySelector("#englishText");
const transcriptionOutput = document.querySelector("#transcriptionOutput");
const transcriptionView = document.querySelector("#transcriptionView");
const weakForms = document.querySelector("#weakForms");
const toolNotice = document.querySelector("#toolNotice");
const clearTool = document.querySelector("#clearTool");
const copyIpa = document.querySelector("#copyIpa");
const editIpa = document.querySelector("#editIpa");
const ipaEditor = document.querySelector("#ipaEditor");
const exampleSearch = document.querySelector("#exampleSearch");
const speakText = document.querySelector("#speakText");
const stopAudio = document.querySelector("#stopAudio");
const voiceSelect = document.querySelector("#voiceSelect");
const speechRate = document.querySelector("#speechRate");
const rateValue = document.querySelector("#rateValue");
const toolAccentButtons = document.querySelectorAll("[data-tool-accent]");
const themeToggle = document.querySelector("#themeToggle");
const symbolCategory = document.querySelector("#symbolCategory");
const symbolAccent = document.querySelector("#symbolAccent");
const symbolVoiceSelect = document.querySelector("#symbolVoiceSelect");
const symbolSpeechRate = document.querySelector("#symbolSpeechRate");
const symbolRateValue = document.querySelector("#symbolRateValue");
const symbolCount = document.querySelector("#symbolCount");
const learnSymbol = document.querySelector("#learnSymbol");
const learnName = document.querySelector("#learnName");
const learnDescription = document.querySelector("#learnDescription");
const learnExampleWord = document.querySelector("#learnExampleWord");
const learnExampleIpa = document.querySelector("#learnExampleIpa");
const playSymbolSound = document.querySelector("#playSymbolSound");
const playSymbolExample = document.querySelector("#playSymbolExample");
const prevSymbol = document.querySelector("#prevSymbol");
const nextSymbol = document.querySelector("#nextSymbol");
const phonemePanel = document.querySelector("#phonemePanel");
const phonemeMode = document.querySelector("#phonemeMode");
const phonemeCategory = document.querySelector("#phonemeCategory");
const consonantAnswers = document.querySelector("#consonantAnswers");
const vowelAnswers = document.querySelector("#vowelAnswers");
const symbolAnswerRow = document.querySelector("#symbolAnswerRow");
const phonemeSymbolAnswer = document.querySelector("#phonemeSymbolAnswer");
const phonemeSubmit = document.querySelector("#phonemeSubmit");
const syllablePanel = document.querySelector("#syllablePanel");
const syllableIpaAnswer = document.querySelector("#syllableIpaAnswer");
const syllableSplitAnswer = document.querySelector("#syllableSplitAnswer");
const syllableSubmit = document.querySelector("#syllableSubmit");
const placeAnswer = document.querySelector("#placeAnswer");
const mannerAnswer = document.querySelector("#mannerAnswer");
const voicingAnswer = document.querySelector("#voicingAnswer");
const heightAnswer = document.querySelector("#heightAnswer");
const backnessAnswer = document.querySelector("#backnessAnswer");
const roundingAnswer = document.querySelector("#roundingAnswer");
const minimalAccent = document.querySelector("#minimalAccent");
const minimalCategory = document.querySelector("#minimalCategory");
const minimalLevel = document.querySelector("#minimalLevel");
const nextMinimalPairButton = document.querySelector("#nextMinimalPair");
const minimalPairForm = document.querySelector("#minimalPairForm");
const minimalWord1 = document.querySelector("#minimalWord1");
const minimalWord2 = document.querySelector("#minimalWord2");
const minimalLabel1 = document.querySelector("#minimalLabel1");
const minimalLabel2 = document.querySelector("#minimalLabel2");
const minimalIpa1 = document.querySelector("#minimalIpa1");
const minimalIpa2 = document.querySelector("#minimalIpa2");
const minimalIpaKeys = document.querySelector("#minimalIpaKeys");
const submitMinimalPair = document.querySelector("#submitMinimalPair");
const minimalFeedback = document.querySelector("#minimalFeedback");
const minimalScore = document.querySelector("#minimalScore");
const minimalAccuracy = document.querySelector("#minimalAccuracy");
const playMinimalWord1 = document.querySelector("#playMinimalWord1");
const playMinimalWord2 = document.querySelector("#playMinimalWord2");
const minimalVoiceSelect = document.querySelector("#minimalVoiceSelect");
const minimalSpeechRate = document.querySelector("#minimalSpeechRate");
const minimalRateValue = document.querySelector("#minimalRateValue");
const explorerAccent = document.querySelector("#explorerAccent");
const nextExplorerWordButton = document.querySelector("#nextExplorerWord");
const explorerWord = document.querySelector("#explorerWord");
const explorerIpa = document.querySelector("#explorerIpa");
const explorerSyllables = document.querySelector("#explorerSyllables");
const explorerStress = document.querySelector("#explorerStress");
const explorerWordType = document.querySelector("#explorerWordType");
const playExplorerWord = document.querySelector("#playExplorerWord");
const explorerVoiceSelect = document.querySelector("#explorerVoiceSelect");
const explorerSpeechRate = document.querySelector("#explorerSpeechRate");
const explorerRateValue = document.querySelector("#explorerRateValue");

let currentQuestion = null;
let currentMinimalPair = null;
let currentExplorerWord = null;
let correctCount = 0;
/* MatHub integration: tell the parent page about graded answers (XP), follow its theme, hide the header when embedded. */
function reportToMatHub(correct) { try { if (window.parent !== window) window.parent.postMessage({ type: 'mathub-xp', correct: !!correct }, location.origin); } catch (e) {} }
(function () { const qp = new URLSearchParams(location.search); if (qp.get('embed')) document.body.classList.add('embedded'); window.addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'mathub-theme') document.body.classList.toggle('dark', !!e.data.dark); }); })();
let totalCount = 0;
let questionAnswered = false;
let syllableStep = "ipa";
let minimalCorrectCount = 0;
let minimalTotalCount = 0;
let minimalPairAnswered = false;
let toolAccent = "uk";
let lastIpaText = "";
let voices = [];
const onlineIpaCache = new Map();
let renderRequestId = 0;
let symbolIndex = 0;
let activeIpaInput = answerInput;
let activeMinimalIpaInput = minimalIpa1;

const APPROVED_VOICE_NAMES = {
  uk: ["Google UK English Female", "Google UK English Male"],
  us: ["Google US English"]
};

WORD_BANK.forEach((item) => {
  if (!item.usIpa) item.usIpa = americanizeIpa(item.ipa);
  if (!item.syllableUk) item.syllableUk = item.ipa;
  if (!item.syllableUs) item.syllableUs = item.usIpa;
});

const EXTRA_LOOKUP_ITEMS = EXTRA_TRANSCRIPTION_WORDS.map(([word, ipa, usIpa]) => ({
  word,
  ipa,
  usIpa: usIpa || americanizeIpa(ipa)
}));

function parseProvidedWords(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [word, ipa, usIpa] = line.split("|").map((part) => part.trim());
      return { word, ipa, usIpa: usIpa || americanizeIpa(ipa) };
    });
}

const PROVIDED_LOOKUP_ITEMS = parseProvidedWords(PROVIDED_WORDS_TEXT);

const WORD_LOOKUP = new Map([...WORD_BANK, ...EXTRA_LOOKUP_ITEMS, ...PROVIDED_LOOKUP_ITEMS].map((item) => [item.word.toLowerCase(), item]));

const WORD_TYPE_MAP = new Map(
  Object.entries({
    i: "pronoun",
    you: "pronoun",
    we: "pronoun",
    they: "pronoun",
    my: "determiner",
    he: "pronoun",
    she: "pronoun",
    it: "pronoun",
    this: "determiner / pronoun",
    that: "determiner / pronoun",
    the: "determiner",
    a: "determiner",
    an: "determiner",
    and: "conjunction",
    but: "conjunction",
    or: "conjunction",
    because: "conjunction",
    to: "preposition",
    of: "preposition",
    for: "preposition",
    in: "preposition",
    on: "preposition",
    at: "preposition",
    with: "preposition",
    without: "preposition",
    about: "preposition / adverb",
    above: "preposition / adverb",
    across: "preposition / adverb",
    after: "preposition / conjunction / adverb",
    before: "preposition / conjunction / adverb",
    light: "noun / verb / adjective",
    record: "noun / verb",
    live: "verb / adjective",
    address: "noun / verb",
    object: "noun / verb",
    increase: "noun / verb",
    use: "noun / verb",
    present: "noun / verb / adjective",
    close: "verb / adjective / adverb",
    right: "noun / adjective / adverb",
    hard: "adjective / adverb",
    fast: "adjective / adverb",
    well: "adverb / adjective / noun",
    good: "adjective",
    beautiful: "adjective",
    important: "adjective",
    phonetics: "noun",
    syllabification: "noun",
    stress: "noun / verb",
    pronunciation: "noun",
    word: "noun",
    sound: "noun / verb",
    practice: "noun / verb",
    study: "noun / verb",
    teacher: "noun",
    student: "noun",
    dog: "noun",
    cat: "noun",
    music: "noun",
    school: "noun",
    friend: "noun",
    home: "noun / adverb",
    love: "noun / verb",
    look: "noun / verb",
    play: "noun / verb",
    work: "noun / verb",
    water: "noun / verb",
    phone: "noun / verb",
    open: "verb / adjective",
    clear: "verb / adjective",
    answer: "noun / verb",
    have: "verb",
    name: "noun / verb",
    is: "verb",
    sad: "adjective",
    text: "noun / verb",
    call: "noun / verb",
    speak: "verb",
    sheet: "noun",
    make: "verb / noun",
    graph: "noun / verb",
    shirt: "noun",
    blood: "noun",
    touch: "noun / verb",
    new: "adjective",
    fight: "noun / verb",
    stay: "noun / verb",
    brown: "adjective / noun / verb",
    gas: "noun / verb",
    quick: "adjective",
    ripe: "adjective",
    fun: "noun / adjective",
    soon: "adverb",
    ship: "noun / verb",
    zoo: "noun",
    mail: "noun / verb",
    red: "noun / adjective",
    know: "verb",
    drive: "noun / verb",
    split: "noun / verb / adjective",
    tank: "noun / verb",
    kind: "noun / adjective",
    paper: "noun / verb",
    wicked: "adjective",
    admit: "verb",
    focus: "noun / verb",
    idea: "noun",
    behave: "verb",
    police: "noun / verb",
    pleasure: "noun",
    father: "noun / verb",
    photo: "noun",
    control: "noun / verb",
    garden: "noun / verb",
    cassette: "noun",
    party: "noun / verb",
    doctor: "noun / verb",
    winter: "noun / verb",
    brother: "noun",
    dinner: "noun",
    river: "noun",
    pencil: "noun / verb",
    giraffe: "noun",
    parade: "noun / verb",
    antique: "noun / adjective",
    create: "verb",
    native: "noun / adjective",
    balloon: "noun / verb",
    shampoo: "noun / verb",
    taboo: "noun / adjective / verb",
    angry: "adjective",
    central: "adjective",
    complete: "verb / adjective",
    intense: "adjective",
    precise: "adjective",
    locate: "verb",
    argue: "verb",
    enter: "verb",
    knowledge: "noun",
    cinema: "noun",
    holiday: "noun / verb",
    family: "noun / adjective",
    energy: "noun",
    harmony: "noun",
    company: "noun",
    excellent: "adjective",
    consider: "verb",
    visitor: "noun",
    delicate: "adjective / noun",
    terrible: "adjective",
    adventure: "noun / verb",
    remember: "verb",
    delicious: "adjective",
    banana: "noun",
    disaster: "noun",
    celebrate: "verb",
    animal: "noun / adjective",
    chocolate: "noun / adjective",
    medicine: "noun",
    positive: "noun / adjective",
    happiness: "noun",
    aquamarine: "noun / adjective",
    understand: "verb",
    controversial: "adjective",
    television: "noun",
    university: "noun",
    employee: "noun",
    japanese: "noun / adjective",
    classroom: "noun",
    textbook: "noun / adjective",
    produce: "noun / verb",
    contrast: "noun / verb",
    permit: "noun / verb",
    progress: "noun / verb",
    question: "noun / verb"
  })
);

function americanizeIpa(ipa) {
  return ipa
    .replaceAll("ɒ", "ɑː")
    .replaceAll("ɑː", "ɑː")
    .replaceAll("ə/", "ɚ/")
    .replaceAll(".ə/", ".ɚ/")
    .replaceAll("eɪ.pə", "eɪ.pɚ")
    .replaceAll("tʃə", "tʃɚ")
    .replaceAll("ðə", "ðɚ")
    .replaceAll("tə", "tɚ")
    .replaceAll("də", "dɚ");
}

function selectedAccent() {
  return accentSelect.value;
}

function ipaFor(item, accent = selectedAccent(), useWeak = false) {
  if (useWeak && accent === "uk" && item.weakUk) return item.weakUk;
  if (useWeak && accent === "us" && item.weakUs) return item.weakUs;
  return accent === "us" ? item.usIpa : item.ipa;
}

function sentenceIpaFor(item, accent = selectedAccent()) {
  return accent === "us" ? item.usIpa : item.ipa;
}

function addExplicitStressBoundaries(ipa) {
  return ipa.replace(/([^\/\s.(])([ˈˌ])/g, "$1.$2");
}

function syllabifiedIpaFor(item, accent = selectedAccent()) {
  const ipa = accent === "us" ? item.syllableUs || item.usIpa : item.syllableUk || item.ipa;
  return addExplicitStressBoundaries(ipa);
}

function unsyllabifiedIpaFor(item, accent = selectedAccent()) {
  return syllabifiedIpaFor(item, accent).replace(/[.·]/g, "");
}

function displaySyllableAnswer(text) {
  return text
    .replace(/[\/[\]()]/g, "")
    .replace(/·/g, ".")
    .replace(/\s+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function normalizeSyllabifiedIpa(text) {
  if (/[-‐‑‒–—]/.test(text) || /·/.test(text)) return null;
  return text
    .toLowerCase()
    .trim()
    .replace(/[\/[\]()]/g, "")
    .replace(/[ˈˌ]/g, "")
    .replace(/\s+/g, "")
    .replace(/\.+/g, ".")
    .replaceAll("ɡ", "g")
    .replaceAll("ɛ", "e")
    .replaceAll(":", "ː");
}

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[ˈˌ/[\]()]/g, "")
    .replace(/[.·-]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeIpa(text) {
  return normalize(text)
    .replaceAll("ɡ", "g")
    .replaceAll("ɛ", "e")
    .replaceAll(":", "ː");
}

function normalizeIpaTranscription(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[ˈˌ/[\]()]/g, "")
    .replace(/[.,!?;:"“”‘’]/g, "")
    .replace(/[·.-]/g, "")
    .replace(/\s+/g, " ")
    .replaceAll("ɡ", "g")
    .replaceAll("ɛ", "e")
    .replaceAll(":", "ː");
}

function ipaWithoutSlashes(text) {
  return normalizeIpa(text).replace(/^\/|\/$/g, "");
}

function normalizePlainEnglish(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function currentWords() {
  const mode = modeSelect.value;
  if (mode === "sentenceToIpa" || mode === "ipaToSentence") {
    return SENTENCE_BANK.filter((item) => item.level === levelSelect.value);
  }
  if (mode === "phonemeDescription") {
    return phonemeCategory.value === "vowels" ? PHONEME_VOWELS : PHONEME_CONSONANTS;
  }
  return WORD_BANK.filter((item) => item.level === levelSelect.value && !(mode === "stress" && item.avoidStress));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function syllableAnswer(item) {
  return item.syllables.join(".");
}

function stressAnswer(item) {
  return `${item.stress} (${item.syllables[item.stress - 1]})`;
}

function expectedAnswers(item, mode) {
  if (mode === "wordToIpa") return [ipaFor(item), ...(item.ipaAlt || [])];
  if (mode === "ipaToWord") return [item.word];
  if (mode === "sentenceToIpa") return [sentenceIpaFor(item)];
  if (mode === "ipaToSentence") return [item.text];
  if (mode === "syllabification") return [syllabifiedIpaFor(item)];
  return [String(item.stress), item.syllables[item.stress - 1]];
}

function isCorrect(userAnswer, item, mode) {
  const answers = expectedAnswers(item, mode);
  if (mode === "wordToIpa" || mode === "sentenceToIpa") {
    return answers.some((answer) => normalizeIpaTranscription(answer) === normalizeIpaTranscription(userAnswer));
  }
  if (mode === "ipaToSentence") {
    return answers.some((answer) => normalizePlainEnglish(answer) === normalizePlainEnglish(userAnswer));
  }
  return answers.some((answer) => normalize(answer) === normalize(userAnswer));
}

function updateGuide() {
  const guide = GUIDES[modeSelect.value];
  guideTitle.textContent = guide.title;
  guideText.textContent = guide.text;
  guideExample.textContent = guide.example;
}

function updateScore() {
  scoreBox.textContent = `${totalCount} answered`;
  accuracyBox.textContent =
    totalCount === 0 ? "No score yet" : `${correctCount} correct · ${Math.round((correctCount / totalCount) * 100)}%`;
}

function resetScore() {
  correctCount = 0;
  totalCount = 0;
  updateScore();
}

function updateMinimalScore() {
  minimalScore.textContent = `${minimalTotalCount} pair${minimalTotalCount === 1 ? "" : "s"}`;
  minimalAccuracy.textContent =
    minimalTotalCount === 0
      ? "No score yet"
      : `${minimalCorrectCount} correct · ${Math.round((minimalCorrectCount / minimalTotalCount) * 100)}%`;
}

function minimalPairIpa(item, wordNumber) {
  const accent = minimalAccent.value === "us" ? "us" : "uk";
  return item[`${accent}Ipa${wordNumber}`];
}

function currentMinimalPairs() {
  return MINIMAL_PAIR_BANK.filter((item) => item.category === minimalCategory.value && item.level === minimalLevel.value);
}

function currentExplorerWords() {
  return WORD_BANK;
}

function setSubmitLocked(isLocked) {
  submitAnswer.disabled = isLocked;
  phonemeSubmit.disabled = isLocked;
  syllableSubmit.disabled = isLocked;
}

function buildIpaKeyboard() {
  ipaKeys.replaceChildren();

  Object.entries(IPA_KEYS).forEach(([groupName, symbols]) => {
    const group = document.createElement("div");
    group.className = "ipa-group";

    const title = document.createElement("h3");
    title.textContent = groupName;
    group.append(title);

    const keys = document.createElement("div");
    keys.className = "ipa-key-row";

    symbols.forEach((symbol) => {
      const key = document.createElement("button");
      key.type = "button";
      key.textContent = symbol === " " ? "space" : symbol;
      key.addEventListener("click", () => {
        const target = activeIpaInput || answerInput;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const before = target.value.slice(0, start);
        const after = target.value.slice(end);
        target.value = `${before}${symbol}${after}`;
        target.focus();
        target.selectionStart = target.selectionEnd = start + symbol.length;
      });
      keys.append(key);
    });

    group.append(keys);
    ipaKeys.append(group);
  });
}

function buildMinimalIpaKeyboard() {
  minimalIpaKeys.replaceChildren();

  Object.entries(IPA_KEYS).forEach(([groupName, symbols]) => {
    const group = document.createElement("div");
    group.className = "ipa-group";

    const title = document.createElement("h3");
    title.textContent = groupName;
    group.append(title);

    const keys = document.createElement("div");
    keys.className = "ipa-key-row";

    symbols.forEach((symbol) => {
      const key = document.createElement("button");
      key.type = "button";
      key.textContent = symbol === " " ? "space" : symbol;
      key.addEventListener("click", () => {
        const target = activeMinimalIpaInput || minimalIpa1;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const before = target.value.slice(0, start);
        const after = target.value.slice(end);
        target.value = `${before}${symbol}${after}`;
        target.focus();
        target.selectionStart = target.selectionEnd = start + symbol.length;
      });
      keys.append(key);
    });

    group.append(keys);
    minimalIpaKeys.append(group);
  });
}

function fillSelect(select, values) {
  select.replaceChildren();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function buildPhonemeControls() {
  fillSelect(placeAnswer, PHONEME_OPTIONS.place);
  fillSelect(mannerAnswer, PHONEME_OPTIONS.manner);
  fillSelect(voicingAnswer, PHONEME_OPTIONS.voicing);
  fillSelect(heightAnswer, PHONEME_OPTIONS.height);
  fillSelect(backnessAnswer, PHONEME_OPTIONS.backness);
  fillSelect(roundingAnswer, PHONEME_OPTIONS.rounding);
}

function phonemeIsVowel() {
  return phonemeCategory.value === "vowels";
}

function phonemePrompt(item) {
  if (phonemeMode.value === "descriptionToSymbol") {
    return phonemeIsVowel()
      ? `${item.height} ${item.backness} ${item.rounding.toLowerCase()} vowel`
      : `${item.voicing} ${item.place.toLowerCase()} ${item.manner.toLowerCase()}`;
  }
  return item.symbol;
}

function configurePhonemePanel(item) {
  const isDescriptionToSymbol = phonemeMode.value === "descriptionToSymbol";
  const isVowel = phonemeIsVowel();

  activeIpaInput = isDescriptionToSymbol ? phonemeSymbolAnswer : answerInput;
  phonemePanel.classList.remove("hidden");
  phonemeSubmit.classList.remove("hidden");
  typingArea.classList.add("hidden");
  choiceArea.classList.add("hidden");
  consonantAnswers.classList.toggle("hidden", isVowel || isDescriptionToSymbol);
  vowelAnswers.classList.toggle("hidden", !isVowel || isDescriptionToSymbol);
  symbolAnswerRow.classList.toggle("hidden", !isDescriptionToSymbol);
  ipaKeyboard.classList.toggle("hidden", !isDescriptionToSymbol);

  promptBox.textContent = phonemePrompt(item);
  answerLabel.setAttribute("for", isDescriptionToSymbol ? "phonemeSymbolAnswer" : "phonemeMode");
  answerLabel.textContent = isDescriptionToSymbol ? "Type the IPA symbol" : "Choose the correct description";
  questionHint.textContent = isVowel
    ? "Vowels are described by height, backness, and lip rounding."
    : "Consonants are described by place, manner, and voicing.";
  phonemeSymbolAnswer.value = "";
}

function checkPhonemeAnswer(item) {
  if (phonemeMode.value === "descriptionToSymbol") {
    return normalizeIpa(phonemeSymbolAnswer.value) === normalizeIpa(item.symbol);
  }

  if (phonemeIsVowel()) {
    return heightAnswer.value === item.height && backnessAnswer.value === item.backness && roundingAnswer.value === item.rounding;
  }

  return placeAnswer.value === item.place && mannerAnswer.value === item.manner && voicingAnswer.value === item.voicing;
}

function phonemeUserAnswer() {
  if (phonemeMode.value === "descriptionToSymbol") return phonemeSymbolAnswer.value || "(blank)";
  if (phonemeIsVowel()) return `${heightAnswer.value}, ${backnessAnswer.value}, ${roundingAnswer.value}`;
  return `${placeAnswer.value}, ${mannerAnswer.value}, ${voicingAnswer.value}`;
}

function phonemeCorrectAnswer(item) {
  if (phonemeMode.value === "descriptionToSymbol") return item.symbol;
  if (phonemeIsVowel()) return `${item.height}, ${item.backness}, ${item.rounding}`;
  return `${item.place}, ${item.manner}, ${item.voicing}`;
}

function showPhonemeFeedback(correct, item) {
  feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
  feedback.replaceChildren();

  const lines = [
    correct ? "Correct." : "Not quite.",
    `Your answer: ${phonemeUserAnswer()}`,
    `Correct answer: ${phonemeCorrectAnswer(item)}`
  ];

  lines.forEach((line, index) => {
    const p = document.createElement("p");
    if (index === 0) {
      const strong = document.createElement("strong");
      strong.textContent = line;
      p.append(strong);
    } else {
      p.textContent = line;
    }
    feedback.append(p);
  });
}

function configureSyllablePanel(item) {
  syllableStep = "ipa";
  activeIpaInput = syllableIpaAnswer;
  syllablePanel.classList.remove("hidden");
  syllableSubmit.classList.remove("hidden");
  syllableSubmit.textContent = "Check transcription";
  syllableIpaAnswer.value = "";
  syllableSplitAnswer.value = "";
  syllableSplitAnswer.disabled = true;
  typingArea.classList.add("hidden");
  choiceArea.classList.add("hidden");
  phonemePanel.classList.add("hidden");
  phonemeSubmit.classList.add("hidden");
  ipaKeyboard.classList.remove("hidden");

  promptBox.textContent = item.word;
  answerLabel.setAttribute("for", "syllableIpaAnswer");
  answerLabel.textContent = "Transcribe first, then syllabify the IPA";
  questionHint.textContent = "Step 1: type the IPA transcription. Step 2 unlocks after the transcription is correct.";
}

function showSyllableStepFeedback(correct, message, expected = "") {
  feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
  feedback.replaceChildren();

  [message, expected].filter(Boolean).forEach((line, index) => {
    const p = document.createElement("p");
    if (index === 0) {
      const strong = document.createElement("strong");
      strong.textContent = line;
      p.append(strong);
    } else {
      p.textContent = line;
    }
    feedback.append(p);
  });
}

function checkSyllabificationStep() {
  if (questionAnswered) return;

  const accent = selectedAccent();
  const correctIpa = unsyllabifiedIpaFor(currentQuestion, accent);
  const correctSyllables = syllabifiedIpaFor(currentQuestion, accent);
  const visibleSyllables = displaySyllableAnswer(correctSyllables);

  if (syllableStep === "ipa") {
    const transcriptionCorrect = normalizeIpa(syllableIpaAnswer.value) === normalizeIpa(correctIpa);
    if (!transcriptionCorrect) {
      showSyllableStepFeedback(false, "Check your transcription before syllabifying.", `Expected IPA: ${correctIpa}`);
      return;
    }

    syllableStep = "syllables";
    activeIpaInput = syllableSplitAnswer;
    syllableSplitAnswer.disabled = false;
    syllableSubmit.textContent = "Check syllabification";
    syllableSplitAnswer.placeholder = "ˈbjuː.tɪ.fəl";
    showSyllableStepFeedback(true, "Correct transcription — now syllabify.");
    syllableSplitAnswer.focus();
    return;
  }

  const syllablesCorrect = normalizeSyllabifiedIpa(syllableSplitAnswer.value) === normalizeSyllabifiedIpa(correctSyllables);
  questionAnswered = true;
  setSubmitLocked(true);
  totalCount += 1;
  if (syllablesCorrect) correctCount += 1;
  reportToMatHub(syllablesCorrect);
  updateScore();
  showSyllableStepFeedback(
    syllablesCorrect,
    syllablesCorrect ? "Correct syllabification." : "Check your syllabified IPA.",
    `IPA: ${displaySyllableAnswer(correctIpa)} · Syllabified: ${visibleSyllables}`
  );
}

function configureMode(item) {
  const mode = modeSelect.value;
  const isIpaTyping = mode === "wordToIpa";

  questionAnswered = false;
  setSubmitLocked(false);
  activeIpaInput = answerInput;
  taskLabel.textContent = GUIDES[mode].title;
  answerLabel.setAttribute("for", "answerInput");
  answerInput.value = "";
  feedback.className = "feedback hidden";
  feedback.textContent = "";
  choiceArea.classList.add("hidden");
  phonemePanel.classList.add("hidden");
  phonemeSubmit.classList.add("hidden");
  syllablePanel.classList.add("hidden");
  syllableSubmit.classList.add("hidden");
  typingArea.classList.remove("hidden");
  ipaKeyboard.classList.toggle("hidden", !isIpaTyping);

  if (mode === "phonemeDescription") {
    configurePhonemePanel(item);
    return;
  }

  if (mode === "syllabification") {
    configureSyllablePanel(item);
    return;
  }

  if (mode === "ipaToWord") {
    promptBox.textContent = ipaFor(item);
    answerLabel.textContent = "Type the English word";
    answerInput.placeholder = "phonetics";
    questionHint.textContent = "Look for the stress mark and vowel sounds.";
  } else if (mode === "sentenceToIpa") {
    promptBox.textContent = item.text;
    answerLabel.textContent = "Type the IPA sentence";
    answerInput.placeholder = "/aɪ ˈlʌv juː/";
    questionHint.textContent = "Use spaces between IPA words.";
  } else if (mode === "ipaToSentence") {
    promptBox.textContent = sentenceIpaFor(item);
    answerLabel.textContent = "Type the English sentence";
    answerInput.placeholder = "I love you.";
    questionHint.textContent = "Capital letters and punctuation are optional.";
  } else if (mode === "stress") {
    promptBox.textContent = item.word;
    answerLabel.textContent = "Type the main stress number";
    answerInput.placeholder = "1, 2, 3...";
    questionHint.textContent = `Count from left to right: ${item.syllables.join(" - ")}`;
  } else {
    promptBox.textContent = item.word;
    answerLabel.textContent = "Type the IPA transcription";
    answerInput.placeholder = "/ʃɜːt/";
    questionHint.textContent = "Use the IPA keyboard below if you need symbols.";
  }
  ipaKeyboard.classList.toggle("hidden", !(mode === "wordToIpa" || mode === "sentenceToIpa"));
}

function showQuestion() {
  currentQuestion = randomItem(currentWords());
  updateGuide();
  configureMode(currentQuestion);
  if (modeSelect.value === "syllabification") {
    syllableIpaAnswer.focus();
  } else if (modeSelect.value === "phonemeDescription" && phonemeMode.value === "descriptionToSymbol") {
    phonemeSymbolAnswer.focus();
  } else if (modeSelect.value !== "phonemeDescription") {
    answerInput.focus();
  }
}

function resetProgress() {
  resetScore();
  showQuestion();
}

function renderMinimalPair() {
  const pairs = currentMinimalPairs();
  currentMinimalPair = randomItem(pairs);
  minimalPairAnswered = false;
  submitMinimalPair.disabled = false;
  minimalFeedback.className = "feedback hidden";
  minimalFeedback.textContent = "";
  minimalIpa1.value = "";
  minimalIpa2.value = "";

  minimalWord1.textContent = currentMinimalPair.word1;
  minimalWord2.textContent = currentMinimalPair.word2;
  minimalLabel1.textContent = `${currentMinimalPair.word1} IPA`;
  minimalLabel2.textContent = `${currentMinimalPair.word2} IPA`;
  minimalIpa1.placeholder = "Type IPA";
  minimalIpa2.placeholder = "Type IPA";
  activeMinimalIpaInput = minimalIpa1;
  minimalIpa1.focus();
}

function showMinimalFeedback(word1Correct, word2Correct) {
  const ipa1 = minimalPairIpa(currentMinimalPair, 1);
  const ipa2 = minimalPairIpa(currentMinimalPair, 2);

  minimalFeedback.className = `feedback ${word1Correct && word2Correct ? "correct" : "incorrect"}`;
  minimalFeedback.replaceChildren();

  const lines = [
    word1Correct && word2Correct ? "Correct." : "Check the corrected IPA below.",
    `${currentMinimalPair.word1}: ${word1Correct ? "correct" : "not quite"} · ${ipa1}`,
    `${currentMinimalPair.word2}: ${word2Correct ? "correct" : "not quite"} · ${ipa2}`,
    `Sound difference: ${currentMinimalPair.difference}`
  ];

  lines.forEach((line, index) => {
    const p = document.createElement("p");
    if (index === 0) {
      const strong = document.createElement("strong");
      strong.textContent = line;
      p.append(strong);
    } else {
      p.textContent = line;
    }
    if (index === 3) p.className = "minimal-difference";
    minimalFeedback.append(p);
  });
}

function resetMinimalProgress() {
  minimalCorrectCount = 0;
  minimalTotalCount = 0;
  updateMinimalScore();
  renderMinimalPair();
}

function inferWordType(item) {
  if (item.wordType || item.type) return item.wordType || item.type;
  const word = item.word.toLowerCase();
  if (WORD_TYPE_MAP.has(word)) return WORD_TYPE_MAP.get(word);
  if (word.endsWith("ly")) return "adverb";
  if (word.endsWith("tion") || word.endsWith("ness") || word.endsWith("ment") || word.endsWith("ity")) return "noun";
  if (word.endsWith("ful") || word.endsWith("ous") || word.endsWith("ive") || word.endsWith("al") || word.endsWith("able")) return "adjective";
  if (word.endsWith("ing") || word.endsWith("ed") || word.endsWith("ate") || word.endsWith("ise") || word.endsWith("ize")) return "verb";
  return "noun";
}

function renderExplorerWord() {
  currentExplorerWord = randomItem(currentExplorerWords());
  explorerWord.textContent = currentExplorerWord.word;
  explorerIpa.textContent = ipaFor(currentExplorerWord, explorerAccent.value);
  explorerSyllables.textContent = currentExplorerWord.syllables.join("-");
  explorerStress.textContent = `syllable ${currentExplorerWord.stress}`;
  explorerWordType.textContent = inferWordType(currentExplorerWord);
}

function showFeedback(correct, item, mode, userAnswer) {
  const answerText = expectedAnswers(item, mode)[0];
  const detail =
    mode === "stress"
      ? `Main stress: syllable ${stressAnswer(item)}.`
      : mode === "syllabification"
        ? `Syllables: ${syllableAnswer(item)}.`
        : `${selectedAccent() === "uk" ? "British RP" : "American"} IPA: ${
            mode === "sentenceToIpa" || mode === "ipaToSentence" ? sentenceIpaFor(item) : ipaFor(item)
          }.`;

  feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
  feedback.replaceChildren();

  const lines = [
    correct ? "Correct." : "Not quite.",
    `Your answer: ${userAnswer || "(blank)"}`,
    `Expected answer: ${answerText}`,
    detail
  ];

  lines.forEach((line, index) => {
    const p = document.createElement("p");
    if (index === 0) {
      const strong = document.createElement("strong");
      strong.textContent = line;
      p.append(strong);
    } else {
      p.textContent = line;
    }
    feedback.append(p);
  });

  if (item.source) {
    const source = document.createElement("a");
    source.href = item.source;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = "Check on Cambridge Dictionary";
    feedback.append(source);
  }
}

function switchSection(sectionId) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === sectionId));
  appSections.forEach((section) => section.classList.toggle("active", section.id === sectionId));
  if (sectionId === "toolSection") renderTranscription();
  if (sectionId === "symbolSection") renderSymbol();
}

function currentSymbolList() {
  return SYMBOL_LIBRARY[symbolCategory.value] || SYMBOL_LIBRARY.consonants;
}

function renderSymbol() {
  const list = currentSymbolList();
  if (symbolIndex >= list.length) symbolIndex = 0;
  if (symbolIndex < 0) symbolIndex = list.length - 1;
  const item = list[symbolIndex];

  symbolCount.textContent = `${symbolIndex + 1} / ${list.length}`;
  learnSymbol.textContent = item.symbol;
  learnName.textContent = item.name;
  learnDescription.textContent = item.description;
  learnExampleWord.textContent = item.word;
  learnExampleIpa.textContent = item.ipa;
}

function voiceMatchesApprovedName(voice, approvedName) {
  return voice.name === approvedName || voice.name.startsWith(`${approvedName} `) || voice.name.includes(approvedName);
}

function selectedVoice(select) {
  return voices.find((voice) => voice.name === select.value);
}

function speakWithVoice(text, accent, select, rate) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  const chosenVoice = selectedVoice(select);
  if (chosenVoice) utterance.voice = chosenVoice;
  utterance.lang = chosenVoice?.lang || (accent === "us" ? "en-US" : "en-GB");
  window.speechSynthesis.speak(utterance);
}

function speakSymbolSound() {
  const item = currentSymbolList()[symbolIndex];
  speakWithVoice(SOUND_CUES[item.symbol] || item.word, symbolAccent.value, symbolVoiceSelect, Number(symbolSpeechRate.value));
}

function speakExampleWord() {
  speakWithVoice(learnExampleWord.textContent, symbolAccent.value, symbolVoiceSelect, Number(symbolSpeechRate.value));
}

function speakMinimalWord(word) {
  speakWithVoice(word, minimalAccent.value, minimalVoiceSelect, Number(minimalSpeechRate.value));
}

function speakExplorerWord() {
  if (!currentExplorerWord) return;
  speakWithVoice(currentExplorerWord.word, explorerAccent.value, explorerVoiceSelect, Number(explorerSpeechRate.value));
}

function tokenize(text) {
  return text.match(/[A-Za-z']+|[.,!?;:]/g) || [];
}

async function fetchOnlineIpa(word, accent) {
  const cacheKey = `${accent}:${word.toLowerCase()}`;
  if (onlineIpaCache.has(cacheKey)) return onlineIpaCache.get(cacheKey);

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) throw new Error("No dictionary entry");
    const entries = await response.json();
    const phonetics = entries.flatMap((entry) => entry.phonetics || []);
    const preferred = phonetics.find((item) =>
      accent === "uk" ? /-uk\.mp3|uk/i.test(item.audio || "") : /-us\.mp3|us/i.test(item.audio || "")
    );
    const withText = preferred?.text ? preferred : phonetics.find((item) => item.text);
    const ipa = withText?.text || null;
    onlineIpaCache.set(cacheKey, ipa);
    return ipa;
  } catch {
    onlineIpaCache.set(cacheKey, null);
    return null;
  }
}

async function transcribeToken(token, accent, useWeak) {
  if (/^[.,!?;:]$/.test(token)) return token;
  const entry = WORD_LOOKUP.get(token.toLowerCase());
  if (entry) return ipaFor(entry, accent, useWeak);
  return fetchOnlineIpa(token, accent);
}

async function transcribeText(text, accent, useWeak) {
  const tokens = tokenize(text);
  let unknownCount = 0;
  const pieces = [];

  for (const token of tokens) {
    const ipa = await transcribeToken(token, accent, useWeak);
    if (!ipa && !/^[.,!?;:]$/.test(token)) unknownCount += 1;
    pieces.push({ token, ipa });
  }

  return { pieces, unknownCount };
}

function joinIpaPieces(pieces) {
  return pieces
    .map((piece) => piece.ipa || `[${piece.token}]`)
    .join(" ")
    .replace(/\s+([.,!?;:])/g, "$1");
}

async function renderTranscription() {
  const requestId = ++renderRequestId;
  const text = englishText.value.trim();
  const lines = text ? text.split(/\n+/) : [""];
  const view = transcriptionView.value;
  const allIpaLines = [];
  let unknownCount = 0;

  transcriptionOutput.replaceChildren();
  toolNotice.textContent = "Checking the local dictionary and online pronunciations...";

  for (const line of lines) {
    const result = await transcribeText(line, toolAccent, weakForms.checked);
    if (requestId !== renderRequestId) return;
    unknownCount += result.unknownCount;
    const ipaLine = joinIpaPieces(result.pieces);
    allIpaLines.push(ipaLine);

    const row = document.createElement("div");
    row.className = "transcription-row";
    if (view === "line") row.classList.add("line-view");
    if (view === "ipa") row.classList.add("ipa-only");

    const english = document.createElement("div");
    english.className = "english-line";
    english.textContent = line || "Type English text to begin.";

    const ipa = document.createElement("div");
    ipa.className = "ipa-line";

    result.pieces.forEach((piece, index) => {
      const span = document.createElement("span");
      span.textContent = piece.ipa || piece.token;
      if (!piece.ipa && !/^[.,!?;:]$/.test(piece.token)) span.className = "unknown-token";
      ipa.append(span);
      if (index < result.pieces.length - 1) ipa.append(" ");
    });

    if (view === "ipa") {
      row.append(ipa);
    } else if (view === "line") {
      row.append(english, ipa);
    } else {
      row.append(english, ipa);
    }

    transcriptionOutput.append(row);
  }

  lastIpaText = allIpaLines.join("\n");
  ipaEditor.value = lastIpaText;
  toolNotice.textContent =
    unknownCount === 0
      ? `${toolAccent === "uk" ? "British" : "American"} transcription shown using the local dictionary plus online lookup when needed.`
      : `${unknownCount} word${unknownCount === 1 ? "" : "s"} could not be found in the study dictionary yet.`;
}

function populateVoices() {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  fillVoiceSelect(voiceSelect, toolAccent);
  fillVoiceSelect(practiceVoiceSelect, accentSelect.value);
  fillVoiceSelect(minimalVoiceSelect, minimalAccent.value);
  fillVoiceSelect(explorerVoiceSelect, explorerAccent.value);
  fillVoiceSelect(symbolVoiceSelect, symbolAccent.value);
}

function fillVoiceSelect(select, accent) {
  select.replaceChildren();
  const approvedNames = APPROVED_VOICE_NAMES[accent] || APPROVED_VOICE_NAMES.uk;
  const approved = approvedNames
    .map((name) => ({ name, voice: voices.find((voice) => voiceMatchesApprovedName(voice, name)) }))
    .filter((item) => item.voice);

  approved.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = item.voice.name;
    option.textContent = item.name;
    if (index === 0) option.selected = true;
    select.append(option);
  });

  if (approved.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No approved Google voice available";
    select.append(option);
  }
}

function speakCurrentText() {
  if (!window.speechSynthesis) {
    toolNotice.textContent = "Audio is not available in this browser.";
    return;
  }

  speakWithVoice(englishText.value || "Type English text first.", toolAccent, voiceSelect, Number(speechRate.value));
}

function currentPracticeAudioText() {
  if (!currentQuestion) return "Choose a question first.";
  const mode = modeSelect.value;
  if (mode === "sentenceToIpa" || mode === "ipaToSentence") return currentQuestion.text;
  if (mode === "phonemeDescription") return SOUND_CUES[currentQuestion.symbol] || currentQuestion.word || currentQuestion.symbol;
  return currentQuestion.word;
}

function speakPracticePrompt() {
  speakWithVoice(currentPracticeAudioText(), accentSelect.value, practiceVoiceSelect, Number(practiceSpeechRate.value));
}

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const mode = modeSelect.value;

  if (mode === "syllabification") {
    checkSyllabificationStep();
    return;
  }

  if (questionAnswered) return;
  questionAnswered = true;
  setSubmitLocked(true);

  if (mode === "phonemeDescription") {
    const correct = checkPhonemeAnswer(currentQuestion);

    totalCount += 1;
    if (correct) correctCount += 1;
    reportToMatHub(correct);

    updateScore();
    showPhonemeFeedback(correct, currentQuestion);
    return;
  }

  const userAnswer = answerInput.value;
  const correct = isCorrect(userAnswer, currentQuestion, mode);

  totalCount += 1;
  if (correct) correctCount += 1;
  reportToMatHub(correct);

  updateScore();
  showFeedback(correct, currentQuestion, mode, userAnswer);
});

minimalPairForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (minimalPairAnswered) return;

  minimalPairAnswered = true;
  submitMinimalPair.disabled = true;

  const word1Correct = ipaWithoutSlashes(minimalIpa1.value) === ipaWithoutSlashes(minimalPairIpa(currentMinimalPair, 1));
  const word2Correct = ipaWithoutSlashes(minimalIpa2.value) === ipaWithoutSlashes(minimalPairIpa(currentMinimalPair, 2));
  const pairCorrect = word1Correct && word2Correct;

  minimalTotalCount += 1;
  if (pairCorrect) minimalCorrectCount += 1;

  updateMinimalScore();
  showMinimalFeedback(word1Correct, word2Correct);
});

newQuestionButton.addEventListener("click", showQuestion);
resetProgressButton.addEventListener("click", resetProgress);
nextMinimalPairButton.addEventListener("click", renderMinimalPair);
minimalAccent.addEventListener("change", () => {
  populateVoices();
  resetMinimalProgress();
});
minimalCategory.addEventListener("change", resetMinimalProgress);
minimalLevel.addEventListener("change", resetMinimalProgress);
minimalSpeechRate.addEventListener("input", () => {
  minimalRateValue.textContent = `${minimalSpeechRate.value}x`;
});
minimalIpa1.addEventListener("focus", () => {
  activeMinimalIpaInput = minimalIpa1;
});
minimalIpa2.addEventListener("focus", () => {
  activeMinimalIpaInput = minimalIpa2;
});
syllableIpaAnswer.addEventListener("focus", () => {
  activeIpaInput = syllableIpaAnswer;
});
syllableSplitAnswer.addEventListener("focus", () => {
  activeIpaInput = syllableSplitAnswer;
});
playMinimalWord1.addEventListener("click", () => speakMinimalWord(currentMinimalPair.word1));
playMinimalWord2.addEventListener("click", () => speakMinimalWord(currentMinimalPair.word2));
nextExplorerWordButton.addEventListener("click", renderExplorerWord);
explorerAccent.addEventListener("change", () => {
  populateVoices();
  renderExplorerWord();
});
playExplorerWord.addEventListener("click", speakExplorerWord);
explorerSpeechRate.addEventListener("input", () => {
  explorerRateValue.textContent = `${explorerSpeechRate.value}x`;
});
playPracticeAudio.addEventListener("click", speakPracticePrompt);
practiceSpeechRate.addEventListener("input", () => {
  practiceRateValue.textContent = `${practiceSpeechRate.value}x`;
});
accentSelect.addEventListener("change", () => {
  populateVoices();
  resetScore();
  showQuestion();
});
modeSelect.addEventListener("change", () => {
  resetScore();
  showQuestion();
});
levelSelect.addEventListener("change", () => {
  resetScore();
  showQuestion();
});
phonemeMode.addEventListener("change", () => {
  if (modeSelect.value === "phonemeDescription") {
    resetScore();
    showQuestion();
  }
});
phonemeCategory.addEventListener("change", () => {
  if (modeSelect.value === "phonemeDescription") {
    resetScore();
    showQuestion();
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.section));
});

toolAccentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    toolAccent = button.dataset.toolAccent;
    toolAccentButtons.forEach((item) => item.classList.toggle("active", item === button));
    populateVoices();
    renderTranscription();
  });
});

englishText.addEventListener("input", renderTranscription);
transcriptionView.addEventListener("change", renderTranscription);
weakForms.addEventListener("change", renderTranscription);
clearTool.addEventListener("click", () => {
  englishText.value = "";
  renderTranscription();
});
copyIpa.addEventListener("click", async () => {
  await navigator.clipboard.writeText(lastIpaText);
  toolNotice.textContent = "IPA copied.";
});
editIpa.addEventListener("click", () => {
  ipaEditor.classList.toggle("hidden");
  if (!ipaEditor.classList.contains("hidden")) ipaEditor.focus();
});
exampleSearch.addEventListener("click", () => {
  const firstWord = tokenize(englishText.value).find((token) => /[A-Za-z]/.test(token)) || "dog";
  window.open(`https://youglish.com/pronounce/${encodeURIComponent(firstWord)}/english`, "_blank", "noreferrer");
});
speakText.addEventListener("click", speakCurrentText);
stopAudio.addEventListener("click", () => window.speechSynthesis && window.speechSynthesis.cancel());
speechRate.addEventListener("input", () => {
  rateValue.textContent = `${speechRate.value}x`;
});
symbolCategory.addEventListener("change", () => {
  symbolIndex = 0;
  renderSymbol();
});
symbolAccent.addEventListener("change", populateVoices);
symbolSpeechRate.addEventListener("input", () => {
  symbolRateValue.textContent = `${symbolSpeechRate.value}x`;
});
prevSymbol.addEventListener("click", () => {
  symbolIndex -= 1;
  renderSymbol();
});
nextSymbol.addEventListener("click", () => {
  symbolIndex += 1;
  renderSymbol();
});
playSymbolSound.addEventListener("click", speakSymbolSound);
playSymbolExample.addEventListener("click", speakExampleWord);
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  localStorage.setItem("phoneticsTheme", isDark ? "dark" : "light");
});
if (window.speechSynthesis) {
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

buildIpaKeyboard();
buildMinimalIpaKeyboard();
buildPhonemeControls();
renderSymbol();
(function () { const qt = new URLSearchParams(location.search).get('theme'); const dark = qt ? qt === 'dark' : localStorage.getItem("phoneticsTheme") === "dark"; if (dark) { document.body.classList.add("dark"); themeToggle.textContent = "Light mode"; } })();
updateScore();
updateMinimalScore();
showQuestion();
renderMinimalPair();
renderExplorerWord();
renderTranscription();
