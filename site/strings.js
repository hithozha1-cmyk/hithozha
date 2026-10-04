// The words on the landing page, in English and Tamil. Both languages must have exactly the same keys
// (the tests check this). Claims here must match what the app really does today.

const APP = 'https://app.hithozha.in';

const categories = [
  ['Video editing', 'வீடியோ எடிட்டிங்'],
  ['Web design', 'வலைத்தள வடிவமைப்பு'],
  ['Graphic design', 'கிராஃபிக் வடிவமைப்பு'],
  ['Social media', 'சமூக ஊடகம்'],
  ['Photography', 'புகைப்படக்கலை'],
  ['Tuition', 'டியூஷன்'],
  ['Writing', 'எழுத்துப் பணி'],
  ['Voice-over', 'குரல் பதிவு'],
];

const en = {
  lang: 'en',
  htmlLang: 'en',
  dir: 'ltr',
  meta: {
    title: 'Hithozha: work with friends, not strangers | Freelance marketplace in Tamil Nadu',
    description: 'Hire ID-verified freelancers in Tamil Nadu for design, video, websites, tuition and more, or find work close to home. Free to join, in Tamil and English.',
  },
  nav: { how: 'How it works', safety: 'Safety', plans: 'Plans', faq: 'FAQ', open: 'Open Hithozha' },
  hero: {
    kicker: 'Freelance marketplace for Tamil Nadu',
    title: 'Work with friends, not strangers',
    text: 'Hire ID-verified freelancers from Tamil Nadu for logos, videos, websites, tuition and more. Or find work close to home, in Tamil or English.',
    primary: 'Open Hithozha',
    secondary: 'See how it works',
    note: 'Free to join. No card needed.',
  },
  trust: [
    ['ID-checked freelancers', 'Every freelancer is checked with Aadhaar, PAN and a selfie by our team.'],
    ['Tamil and English', 'Use the whole app in the language you are comfortable in.'],
    ['A real team behind it', 'Reports and disputes are read and decided by people, not bots.'],
    ['Payment held until you approve', 'Online payment is opening soon. See the questions below.'],
  ],
  video: {
    title: 'See Hithozha in 48 seconds',
    text: 'A short tour of how it works. The video is in Tamil and has music only, no voice.',
    label: 'Hithozha tour video, 48 seconds',
    description: 'A 48-second tour of Hithozha, the freelance marketplace for Tamil Nadu.',
  },
  how: {
    title: 'How it works',
    clients: {
      title: 'If you want to hire',
      steps: [
        ['Post a job, free', 'Say what you need and your budget. It takes about two minutes.'],
        ['Compare or order', 'Read proposals from freelancers, or order a ready-made package at a fixed price.'],
        ['Chat, receive, approve', 'Talk inside Hithozha, check the work, approve it and leave a review.'],
      ],
    },
    freelancers: {
      title: 'If you want to work',
      steps: [
        ['Join and get verified, free', 'Send your Aadhaar, PAN and a selfie. We check them and then delete the photos.'],
        ['Apply or sell packages', 'Apply to jobs with tokens (10 free every month), or publish packages like "Logo design, Rs 1500, 3 days".'],
        ['Deliver and earn', 'Do the work, get approved, build your reviews. Hithozha keeps 5% on the free plan.'],
      ],
    },
  },
  categories: { title: 'What people hire for', items: categories.map((c) => c[0]) },
  safety: {
    title: 'Built so you can trust who you work with',
    items: [
      ['Identity checked', 'Freelancers send Aadhaar, PAN and a selfie. Only our team sees them, only to check who they are, and the photos are deleted after the check.'],
      ['Stay inside Hithozha', 'Phone numbers, emails, links and requests to pay outside the app are hidden in chat, so your work stays protected.'],
      ['Problems get a person', 'If something goes wrong, either side can report it. Our team reads the chat and decides.'],
      ['Report anything', 'Every profile and job has a report button for scams, spam or abuse.'],
    ],
  },
  plans: {
    title: 'Free to start. Grow when you are ready.',
    note: 'Paid plans open soon. Everyone starts on Free.',
    freelancerTitle: 'For freelancers',
    clientTitle: 'For clients',
    perMonth: 'a month',
    free: 'Free',
    soon: 'Opening soon',
    freelancer: [
      ['Free', '0', ['10 free tokens every month', 'Hithozha keeps 5% of each order', 'Up to 3 packages']],
      ['Pro', '199', ['50 tokens every month', 'Hithozha keeps 3% of each order', 'Up to 10 packages']],
      ['Elite', '499', ['150 tokens every month', 'Hithozha keeps 2% of each order', 'Unlimited packages']],
    ],
    client: [
      ['Free', '0', ['Post jobs for free', '3 open jobs at a time']],
      ['Business', '299', ['10 open jobs at a time', 'For growing shops and teams']],
      ['Startup', '499', ['Unlimited open jobs', 'For busy hiring']],
    ],
    tokens: 'A token is what you spend to apply to a job. You get it back if you are hired, or if the client closes the job without opening your proposal.',
  },
  faq: {
    title: 'Questions',
    items: [
      ['Is Hithozha free?', 'Joining and posting jobs is free. Freelancers get 10 free tokens every month to apply to jobs. Paid plans for extra tokens and lower fees open soon.'],
      ['Who can work on Hithozha?', 'Freelancers in Tamil Nadu who pass our identity check: Aadhaar, PAN and a selfie, reviewed by our team. The photos are deleted after the check.'],
      ['How does payment work?', 'The plan is that the client pays when an order starts, the money is held, and it goes to the freelancer when the client approves the work. Online payment is being switched on, so for now orders are tracked in the app but money does not move through Hithozha.'],
      ['What does Hithozha charge?', 'Clients pay the price of the accepted proposal and nothing extra. Hithozha keeps a fee from the freelancer: 5% on the free plan, less on paid plans. The rate is fixed when the order is made.'],
      ['What are tokens?', 'Tokens are used for actions inside Hithozha, like applying to a job. Free tokens come every month and expire at the end of it. Tokens you earn or buy never expire. They cannot be exchanged for cash.'],
      ['Can I use it in Tamil?', 'Yes. The whole app works in Tamil and English, and you can switch any time.'],
      ['What if something goes wrong?', 'Report the person or job, or open a dispute on the order. Our team reads the chat and decides.'],
    ],
  },
  cta: { title: 'Ready to start?', text: 'Open Hithozha in your browser, sign up in a minute and post your first job or finish your profile.', button: 'Open Hithozha' },
  footer: {
    tagline: 'Work with friends, not strangers.',
    legal: 'Legal',
    contact: 'Contact',
    rights: 'Hithozha, Tamil Nadu, India.',
    language: 'தமிழ்',
  },
  legalPages: { terms: 'Terms and Conditions', privacy: 'Privacy Policy', refunds: 'Refunds and Cancellation', contact: 'Contact us' },
  legalBack: 'Back to home',
  appUrl: APP,
};

const ta = {
  lang: 'ta',
  htmlLang: 'ta',
  dir: 'ltr',
  meta: {
    title: 'ஹித்தோழா: அந்நியர்களுடன் அல்ல, நண்பர்களுடன் வேலை செய்யுங்கள் | தமிழ்நாட்டின் ஃப்ரீலான்ஸ் தளம்',
    description: 'வடிவமைப்பு, வீடியோ, வலைத்தளம், டியூஷன் மற்றும் பலவற்றுக்கு அடையாளம் சரிபார்க்கப்பட்ட தமிழ்நாட்டு ஃப்ரீலான்சர்களை அமர்த்துங்கள், அல்லது உங்கள் ஊரிலேயே வேலை தேடுங்கள். சேர இலவசம், தமிழிலும் ஆங்கிலத்திலும்.',
  },
  nav: { how: 'எப்படிச் செயல்படுகிறது', safety: 'பாதுகாப்பு', plans: 'திட்டங்கள்', faq: 'கேள்விகள்', open: 'ஹித்தோழாவைத் திற' },
  hero: {
    kicker: 'தமிழ்நாட்டுக்கான ஃப்ரீலான்ஸ் தளம்',
    title: 'அந்நியர்களுடன் அல்ல, நண்பர்களுடன் வேலை செய்யுங்கள்',
    text: 'லோகோ, வீடியோ, வலைத்தளம், டியூஷன் மற்றும் பலவற்றுக்கு அடையாளம் சரிபார்க்கப்பட்ட தமிழ்நாட்டு ஃப்ரீலான்சர்களை அமர்த்துங்கள். அல்லது உங்கள் ஊரிலேயே வேலை தேடுங்கள், தமிழிலோ ஆங்கிலத்திலோ.',
    primary: 'ஹித்தோழாவைத் திற',
    secondary: 'எப்படிச் செயல்படுகிறது',
    note: 'சேர இலவசம். கார்டு தேவையில்லை.',
  },
  trust: [
    ['அடையாளம் சரிபார்க்கப்பட்ட ஃப்ரீலான்சர்கள்', 'ஒவ்வொரு ஃப்ரீலான்சரும் ஆதார், பான் மற்றும் செல்ஃபியுடன் எங்கள் குழுவால் சரிபார்க்கப்படுகிறார்.'],
    ['தமிழ் மற்றும் ஆங்கிலம்', 'உங்களுக்கு வசதியான மொழியில் முழு ஆப்பையும் பயன்படுத்துங்கள்.'],
    ['பின்னால் உண்மையான குழு', 'புகார்களையும் சர்ச்சைகளையும் ரோபோக்கள் அல்ல, மனிதர்கள் படித்து முடிவு செய்கிறார்கள்.'],
    ['நீங்கள் ஏற்கும் வரை பணம் பாதுகாப்பு', 'ஆன்லைன் பணம் செலுத்துதல் விரைவில் திறக்கும். கீழே உள்ள கேள்விகளைப் பாருங்கள்.'],
  ],
  video: {
    title: '48 வினாடிகளில் ஹித்தோழா',
    text: 'இது எப்படிச் செயல்படுகிறது என்பதற்கான சிறு சுற்றுலா. வீடியோ தமிழில், இசை மட்டும், குரல் இல்லை.',
    label: 'ஹித்தோழா அறிமுக வீடியோ, 48 வினாடிகள்',
    description: 'தமிழ்நாட்டுக்கான ஃப்ரீலான்ஸ் தளமான ஹித்தோழாவின் 48 வினாடி அறிமுகம்.',
  },
  how: {
    title: 'எப்படிச் செயல்படுகிறது',
    clients: {
      title: 'நீங்கள் வேலைக்கு ஆள் எடுக்க விரும்பினால்',
      steps: [
        ['வேலையைப் பதிவிடுங்கள், இலவசம்', 'உங்களுக்கு என்ன வேண்டும், பட்ஜெட் என்ன என்று சொல்லுங்கள். சுமார் இரண்டு நிமிடம் ஆகும்.'],
        ['ஒப்பிடுங்கள் அல்லது ஆர்டர் செய்யுங்கள்', 'ஃப்ரீலான்சர்களின் முன்மொழிவுகளைப் படியுங்கள், அல்லது நிலையான விலையில் தயாராக உள்ள தொகுப்பை ஆர்டர் செய்யுங்கள்.'],
        ['பேசுங்கள், பெறுங்கள், ஏற்றுக்கொள்ளுங்கள்', 'ஹித்தோழாவுக்குள்ளேயே பேசுங்கள், வேலையைச் சரிபாருங்கள், ஏற்றுக்கொண்டு மதிப்புரை எழுதுங்கள்.'],
      ],
    },
    freelancers: {
      title: 'நீங்கள் வேலை செய்ய விரும்பினால்',
      steps: [
        ['சேருங்கள், சரிபார்க்கப்படுங்கள், இலவசம்', 'ஆதார், பான் மற்றும் ஒரு செல்ஃபியை அனுப்புங்கள். நாங்கள் சரிபார்த்து, பிறகு புகைப்படங்களை நீக்கிவிடுவோம்.'],
        ['விண்ணப்பியுங்கள் அல்லது தொகுப்புகளை விற்கவும்', 'டோக்கன்களால் (ஒவ்வொரு மாதமும் 10 இலவசம்) வேலைகளுக்கு விண்ணப்பியுங்கள், அல்லது "லோகோ வடிவமைப்பு, ரூ 1500, 3 நாட்கள்" போன்ற தொகுப்புகளை வெளியிடுங்கள்.'],
        ['ஒப்படையுங்கள், சம்பாதியுங்கள்', 'வேலையைச் செய்யுங்கள், ஏற்கப்படுங்கள், மதிப்புரைகளைப் பெருக்குங்கள். இலவசத் திட்டத்தில் ஹித்தோழா 5% வைத்துக்கொள்ளும்.'],
      ],
    },
  },
  categories: { title: 'மக்கள் எதற்காக ஆள் எடுக்கிறார்கள்', items: categories.map((c) => c[1]) },
  safety: {
    title: 'யாருடன் வேலை செய்கிறீர்கள் என்று நம்பும்படி உருவாக்கப்பட்டது',
    items: [
      ['அடையாளம் சரிபார்க்கப்படுகிறது', 'ஃப்ரீலான்சர்கள் ஆதார், பான் மற்றும் செல்ஃபியை அனுப்புகிறார்கள். எங்கள் குழு மட்டுமே, அவர்கள் யார் என்று சரிபார்க்க மட்டும் பார்க்கும்; சரிபார்ப்புக்குப் பிறகு புகைப்படங்கள் நீக்கப்படும்.'],
      ['ஹித்தோழாவுக்குள்ளேயே இருங்கள்', 'தொலைபேசி எண்கள், மின்னஞ்சல்கள், இணைப்புகள் மற்றும் ஆப்புக்கு வெளியே பணம் செலுத்தச் சொல்லும் கோரிக்கைகள் அரட்டையில் மறைக்கப்படும்; உங்கள் வேலை பாதுகாப்பாக இருக்கும்.'],
      ['பிரச்சினைகளுக்கு ஒரு மனிதர்', 'ஏதாவது தவறானால் இரு தரப்பும் புகாரளிக்கலாம். எங்கள் குழு அரட்டையைப் படித்து முடிவு செய்யும்.'],
      ['எதையும் புகாரளியுங்கள்', 'ஒவ்வொரு சுயவிவரத்திலும் வேலையிலும் மோசடி, ஸ்பாம் அல்லது துன்புறுத்தலுக்கான புகார் பொத்தான் உள்ளது.'],
    ],
  },
  plans: {
    title: 'இலவசமாகத் தொடங்குங்கள். தயாரானதும் வளருங்கள்.',
    note: 'கட்டணத் திட்டங்கள் விரைவில் திறக்கும். எல்லோரும் இலவசத் திட்டத்தில் தொடங்குகிறார்கள்.',
    freelancerTitle: 'ஃப்ரீலான்சர்களுக்கு',
    clientTitle: 'வாடிக்கையாளர்களுக்கு',
    perMonth: 'மாதம்',
    free: 'இலவசம்',
    soon: 'விரைவில் திறக்கும்',
    freelancer: [
      ['இலவசம்', '0', ['ஒவ்வொரு மாதமும் 10 இலவச டோக்கன்கள்', 'ஒவ்வொரு ஆர்டரிலும் ஹித்தோழா 5% வைத்துக்கொள்ளும்', '3 தொகுப்புகள் வரை']],
      ['ப்ரோ', '199', ['ஒவ்வொரு மாதமும் 50 டோக்கன்கள்', 'ஒவ்வொரு ஆர்டரிலும் ஹித்தோழா 3% வைத்துக்கொள்ளும்', '10 தொகுப்புகள் வரை']],
      ['எலைட்', '499', ['ஒவ்வொரு மாதமும் 150 டோக்கன்கள்', 'ஒவ்வொரு ஆர்டரிலும் ஹித்தோழா 2% வைத்துக்கொள்ளும்', 'வரம்பற்ற தொகுப்புகள்']],
    ],
    client: [
      ['இலவசம்', '0', ['வேலைகளை இலவசமாகப் பதிவிடுங்கள்', 'ஒரே நேரத்தில் 3 திறந்த வேலைகள்']],
      ['பிசினஸ்', '299', ['ஒரே நேரத்தில் 10 திறந்த வேலைகள்', 'வளரும் கடைகள் மற்றும் குழுக்களுக்கு']],
      ['ஸ்டார்ட்அப்', '499', ['வரம்பற்ற திறந்த வேலைகள்', 'அதிக ஆள் எடுப்புக்கு']],
    ],
    tokens: 'டோக்கன் என்பது வேலைக்கு விண்ணப்பிக்கச் செலவழிப்பது. உங்களை வேலைக்கு எடுத்தால், அல்லது வாடிக்கையாளர் உங்கள் முன்மொழிவைத் திறக்காமல் வேலையை மூடினால், அது திரும்பக் கிடைக்கும்.',
  },
  faq: {
    title: 'கேள்விகள்',
    items: [
      ['ஹித்தோழா இலவசமா?', 'சேர்வதும் வேலைகளைப் பதிவிடுவதும் இலவசம். ஃப்ரீலான்சர்களுக்கு வேலைகளுக்கு விண்ணப்பிக்க ஒவ்வொரு மாதமும் 10 இலவச டோக்கன்கள் கிடைக்கும். கூடுதல் டோக்கன்கள் மற்றும் குறைந்த கட்டணத்துக்கான கட்டணத் திட்டங்கள் விரைவில் திறக்கும்.'],
      ['யார் ஹித்தோழாவில் வேலை செய்யலாம்?', 'எங்கள் அடையாளச் சரிபார்ப்பில் தேறும் தமிழ்நாட்டு ஃப்ரீலான்சர்கள்: ஆதார், பான் மற்றும் செல்ஃபி, எங்கள் குழுவால் பார்க்கப்படும். சரிபார்ப்புக்குப் பிறகு புகைப்படங்கள் நீக்கப்படும்.'],
      ['பணம் செலுத்துதல் எப்படிச் செயல்படுகிறது?', 'ஆர்டர் தொடங்கும்போது வாடிக்கையாளர் செலுத்துவார், பணம் பாதுகாப்பாக வைக்கப்படும், வாடிக்கையாளர் வேலையை ஏற்கும்போது அது ஃப்ரீலான்சருக்குச் செல்லும் என்பதே திட்டம். ஆன்லைன் பணம் செலுத்துதல் இயக்கப்பட்டு வருகிறது; இப்போதைக்கு ஆர்டர்கள் ஆப்பில் கண்காணிக்கப்படுகின்றன, ஆனால் பணம் ஹித்தோழா வழியாகச் செல்வதில்லை.'],
      ['ஹித்தோழா என்ன கட்டணம் வாங்குகிறது?', 'ஏற்கப்பட்ட முன்மொழிவின் விலையை வாடிக்கையாளர் செலுத்துவார், கூடுதலாக எதுவும் இல்லை. ஹித்தோழா ஃப்ரீலான்சரிடமிருந்து கட்டணம் வைத்துக்கொள்ளும்: இலவசத் திட்டத்தில் 5%, கட்டணத் திட்டங்களில் குறைவு. ஆர்டர் உருவாகும்போது அந்த விகிதம் நிலையாகிவிடும்.'],
      ['டோக்கன்கள் என்றால் என்ன?', 'டோக்கன்கள் ஹித்தோழாவுக்குள் வேலைக்கு விண்ணப்பிப்பது போன்ற செயல்களுக்கானவை. இலவச டோக்கன்கள் ஒவ்வொரு மாதமும் வரும், அந்த மாத இறுதியில் காலாவதியாகும். நீங்கள் சம்பாதிக்கும் அல்லது வாங்கும் டோக்கன்கள் காலாவதியாகாது. அவற்றைப் பணமாக மாற்ற முடியாது.'],
      ['தமிழில் பயன்படுத்தலாமா?', 'ஆம். முழு ஆப்பும் தமிழிலும் ஆங்கிலத்திலும் செயல்படும், எப்போது வேண்டுமானாலும் மாற்றிக்கொள்ளலாம்.'],
      ['ஏதாவது தவறானால் என்ன செய்வது?', 'அந்த நபரை அல்லது வேலையைப் புகாரளியுங்கள், அல்லது ஆர்டரில் சர்ச்சையைத் திறங்கள். எங்கள் குழு அரட்டையைப் படித்து முடிவு செய்யும்.'],
    ],
  },
  cta: { title: 'தொடங்கத் தயாரா?', text: 'உங்கள் உலாவியிலேயே ஹித்தோழாவைத் திறங்கள், ஒரு நிமிடத்தில் பதிவு செய்து உங்கள் முதல் வேலையைப் பதிவிடுங்கள் அல்லது சுயவிவரத்தை முடியுங்கள்.', button: 'ஹித்தோழாவைத் திற' },
  footer: {
    tagline: 'அந்நியர்களுடன் அல்ல, நண்பர்களுடன் வேலை செய்யுங்கள்.',
    legal: 'சட்டம்',
    contact: 'தொடர்புக்கு',
    rights: 'ஹித்தோழா, தமிழ்நாடு, இந்தியா.',
    language: 'English',
  },
  legalPages: { terms: 'விதிமுறைகள் மற்றும் நிபந்தனைகள்', privacy: 'தனியுரிமைக் கொள்கை', refunds: 'திரும்பப் பெறுதல் மற்றும் ரத்து', contact: 'எங்களைத் தொடர்புகொள்ள' },
  legalBack: 'முகப்புக்குத் திரும்பு',
  appUrl: APP,
};

module.exports = { en, ta };
