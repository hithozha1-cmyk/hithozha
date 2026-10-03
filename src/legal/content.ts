import type { Language } from '@/lib/types';

export type LegalPage = 'terms' | 'privacy' | 'refunds' | 'contact';
export const LEGAL_PAGES: LegalPage[] = ['terms', 'privacy', 'refunds', 'contact'];

/** Fill in phone and address here; empty values are simply not shown on the Contact page. */
export const BUSINESS = {
  name: 'Hithozha',
  email: 'hithozha1@gmail.com',
  phone: '',
  address: 'Tamil Nadu, India',
};

type Page = { title: string; sections: [heading: string, body: string][] };

// Plain-language drafts that describe how the app actually works. Have them reviewed
// by a lawyer before launch.
export const legalContent: Record<Language, Record<LegalPage, Page>> = {
  en: {
    terms: {
      title: 'Terms and Conditions',
      sections: [
        ['What Hithozha is', 'Hithozha is a marketplace in Tamil Nadu where clients post jobs and freelancers offer to do them. We hold the client\'s payment safely until the work is approved. The work agreement is between the client and the freelancer.'],
        ['Your account', 'You sign up with an email address and password and must give correct information. Keep your password private. You must be at least 18 years old to hire or work on Hithozha.'],
        ['Fees', 'Posting a job and applying are free. The client pays the price of the accepted proposal and nothing extra. Hithozha keeps a 5% platform fee from the freelancer\'s side, so the freelancer receives 95% of the price.'],
        ['Payments and escrow', 'Clients pay through Razorpay. The money is held by Hithozha until the client approves the delivered work. After approval, the freelancer\'s earnings are paid out by Hithozha.'],
        ['Rules', 'Keep all work and payments on Hithozha. Do not share phone numbers, emails, links or payment details in chat; we hide them automatically. Fraud, abuse or taking payments outside Hithozha can lead to suspension.'],
        ['Reviews', 'Clients can rate a freelancer after an order is completed. Reviews must be honest and respectful.'],
        ['Problems with an order', 'If something goes wrong, email us with the order details. We review each case and may refund the client or release the payment to the freelancer.'],
        ['Liability and changes', 'Hithozha is not responsible for the quality of work done by freelancers or for what clients ask for, beyond handling payments as described here. We may update these terms; using the app after a change means you accept it. These terms follow the laws of India and the courts of Tamil Nadu.'],
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      sections: [
        ['What we collect', 'Your email, name, city, photo, language and role; freelancer details (skills, rate, portfolio); company details and, if you choose to verify, your GST or Udyam number; jobs, proposals, messages, orders and reviews.'],
        ['Why we use it', 'To run your account, match clients with freelancers, process payments, keep chats safe and show your public profile to other users.'],
        ['What other people see', 'Your name, photo, city and freelancer or company profile are visible to other signed-in users. Your email, password and GST or Udyam number are never shown to other users.'],
        ['Who helps us', 'We use Supabase (database and sign-in), Cloudflare (image storage), Razorpay (payments) and Resend (emails). They process data only to provide their service. We do not sell your data.'],
        ['Chat safety', 'Messages are scanned automatically to hide contact details and requests to pay outside Hithozha. Our team may read flagged messages to keep the community safe.'],
        ['Your choices', 'You can edit your profile in the app. To see or delete your data, email us and we will help.'],
        ['Keeping it safe', 'Data is sent over secure connections and protected by access rules. No system is perfectly secure, so please keep your password private.'],
      ],
    },
    refunds: {
      title: 'Refund and Cancellation Policy',
      sections: [
        ['Before you pay', 'You can cancel an order for free until you pay. The job opens again so you can pick another freelancer.'],
        ['After you pay, before delivery', 'Your money is held safely. If the freelancer cannot deliver, email us and we will refund you in full to your original payment method.'],
        ['After delivery', 'Check the work. When you approve it, the payment is released to the freelancer and it cannot be undone. If the work is not what was agreed, do not approve it; email us instead.'],
        ['How refunds are paid', 'Approved refunds go back to the original payment method through Razorpay. Banks usually take 5 to 7 working days.'],
        ['Disputes', 'Email us with your order details and any messages or files. We review both sides and decide whether to refund the client or release the payment.'],
      ],
    },
    contact: { title: 'Contact us', sections: [['We are here to help', 'Write to us about an order, a payment, your account, or anything in these policies.']] },
  },
  ta: {
    terms: {
      title: 'விதிமுறைகள் மற்றும் நிபந்தனைகள்',
      sections: [
        ['ஹிதோழா என்றால் என்ன', 'ஹிதோழா தமிழ்நாட்டின் ஒரு சந்தை. வாடிக்கையாளர்கள் வேலைகளைப் பதிவிடுகிறார்கள்; ஃப்ரீலான்ஸர்கள் அவற்றைச் செய்ய முன்வருகிறார்கள். வேலை ஏற்கப்படும் வரை வாடிக்கையாளரின் பணத்தை நாங்கள் பாதுகாப்பாக வைத்திருக்கிறோம். வேலை ஒப்பந்தம் வாடிக்கையாளருக்கும் ஃப்ரீலான்ஸருக்கும் இடையிலானது.'],
        ['உங்கள் கணக்கு', 'மின்னஞ்சல் மற்றும் கடவுச்சொல்லுடன் பதிவு செய்கிறீர்கள்; சரியான தகவல்களைத் தர வேண்டும். கடவுச்சொல்லை ரகசியமாக வைத்திருங்கள். ஹிதோழாவில் நியமிக்க அல்லது வேலை செய்ய உங்களுக்கு குறைந்தது 18 வயது இருக்க வேண்டும்.'],
        ['கட்டணங்கள்', 'வேலையைப் பதிவிடுவதும் விண்ணப்பிப்பதும் இலவசம். ஏற்கப்பட்ட முன்மொழிவின் விலையை வாடிக்கையாளர் செலுத்துவார், கூடுதலாக எதுவும் இல்லை. ஹிதோழா ஃப்ரீலான்ஸர் தரப்பிலிருந்து 5% தளக் கட்டணத்தை வைத்துக்கொள்ளும்; ஃப்ரீலான்ஸர் விலையில் 95% பெறுவார்.'],
        ['பணம் செலுத்தல் மற்றும் பாதுகாப்பு', 'வாடிக்கையாளர்கள் Razorpay மூலம் பணம் செலுத்துகிறார்கள். வழங்கப்பட்ட வேலையை வாடிக்கையாளர் ஏற்கும் வரை ஹிதோழா பணத்தைப் பாதுகாப்பாக வைத்திருக்கும். ஏற்ற பிறகு, ஃப்ரீலான்ஸரின் வருமானத்தை ஹிதோழா வழங்கும்.'],
        ['விதிகள்', 'எல்லா வேலையும் பணம் செலுத்தலும் ஹிதோழாவிலேயே இருக்க வேண்டும். தொலைபேசி எண்கள், மின்னஞ்சல்கள், இணைப்புகள் அல்லது பணம் செலுத்தும் விவரங்களை உரையாடலில் பகிர வேண்டாம்; அவற்றை நாங்கள் தானாக மறைக்கிறோம். மோசடி, முறைகேடு அல்லது ஹிதோழாவுக்கு வெளியே பணம் பெறுவது கணக்கு இடைநிறுத்தத்திற்கு வழிவகுக்கும்.'],
        ['மதிப்புரைகள்', 'ஆர்டர் முடிந்த பிறகு வாடிக்கையாளர்கள் ஃப்ரீலான்ஸரை மதிப்பிடலாம். மதிப்புரைகள் நேர்மையாகவும் மரியாதையாகவும் இருக்க வேண்டும்.'],
        ['ஆர்டரில் சிக்கல்', 'ஏதேனும் தவறு நடந்தால், ஆர்டர் விவரங்களுடன் எங்களுக்கு மின்னஞ்சல் அனுப்புங்கள். ஒவ்வொரு வழக்கையும் நாங்கள் பரிசீலித்து, வாடிக்கையாளருக்குப் பணத்தைத் திருப்பலாம் அல்லது ஃப்ரீலான்ஸருக்கு விடுவிக்கலாம்.'],
        ['பொறுப்பு மற்றும் மாற்றங்கள்', 'இங்கே விவரிக்கப்பட்டபடி பணத்தைக் கையாள்வதைத் தாண்டி, ஃப்ரீலான்ஸர்கள் செய்யும் வேலையின் தரத்திற்கோ வாடிக்கையாளர்கள் கேட்பதற்கோ ஹிதோழா பொறுப்பல்ல. இந்த விதிமுறைகளை நாங்கள் புதுப்பிக்கலாம்; மாற்றத்திற்குப் பிறகு ஆப்பைப் பயன்படுத்துவது அதை ஏற்பதாகும். இவை இந்தியச் சட்டங்கள் மற்றும் தமிழ்நாட்டு நீதிமன்றங்களுக்கு உட்பட்டவை.'],
      ],
    },
    privacy: {
      title: 'தனியுரிமைக் கொள்கை',
      sections: [
        ['நாங்கள் சேகரிப்பவை', 'உங்கள் மின்னஞ்சல், பெயர், நகரம், புகைப்படம், மொழி மற்றும் பங்கு; ஃப்ரீலான்ஸர் விவரங்கள் (திறமைகள், கட்டணம், போர்ட்ஃபோலியோ); நிறுவன விவரங்கள் மற்றும் நீங்கள் சரிபார்க்கத் தேர்ந்தால் GST அல்லது உத்யம் எண்; வேலைகள், முன்மொழிவுகள், செய்திகள், ஆர்டர்கள் மற்றும் மதிப்புரைகள்.'],
        ['ஏன் பயன்படுத்துகிறோம்', 'உங்கள் கணக்கை இயக்க, வாடிக்கையாளர்களையும் ஃப்ரீலான்ஸர்களையும் இணைக்க, பணம் செலுத்தல்களைச் செயல்படுத்த, உரையாடல்களைப் பாதுகாப்பாக வைக்க, உங்கள் பொதுச் சுயவிவரத்தை மற்ற பயனர்களுக்குக் காட்ட.'],
        ['மற்றவர்கள் பார்ப்பவை', 'உங்கள் பெயர், புகைப்படம், நகரம் மற்றும் ஃப்ரீலான்ஸர் அல்லது நிறுவன சுயவிவரம் உள்நுழைந்த மற்ற பயனர்களுக்குத் தெரியும். உங்கள் மின்னஞ்சல், கடவுச்சொல், GST அல்லது உத்யம் எண் மற்ற பயனர்களுக்குக் காட்டப்படாது.'],
        ['எங்களுக்கு உதவுபவர்கள்', 'Supabase (தரவுத்தளம் மற்றும் உள்நுழைவு), Cloudflare (படச் சேமிப்பு), Razorpay (பணம் செலுத்தல்) மற்றும் Resend (மின்னஞ்சல்) ஆகியவற்றைப் பயன்படுத்துகிறோம். அவை தங்கள் சேவையை வழங்க மட்டுமே தரவைச் செயலாக்குகின்றன. உங்கள் தரவை நாங்கள் விற்பதில்லை.'],
        ['உரையாடல் பாதுகாப்பு', 'தொடர்பு விவரங்களையும் ஹிதோழாவுக்கு வெளியே பணம் கேட்கும் வார்த்தைகளையும் மறைக்க செய்திகள் தானாக ஆய்வு செய்யப்படுகின்றன. சமூகத்தைப் பாதுகாப்பாக வைக்க, குறியிடப்பட்ட செய்திகளை எங்கள் குழு படிக்கலாம்.'],
        ['உங்கள் தேர்வுகள்', 'ஆப்பில் உங்கள் சுயவிவரத்தைத் திருத்தலாம். உங்கள் தரவைப் பார்க்க அல்லது நீக்க எங்களுக்கு மின்னஞ்சல் அனுப்புங்கள், நாங்கள் உதவுவோம்.'],
        ['பாதுகாப்பாக வைத்தல்', 'தரவு பாதுகாப்பான இணைப்புகள் வழியாக அனுப்பப்பட்டு அணுகல் விதிகளால் பாதுகாக்கப்படுகிறது. எந்த அமைப்பும் முழுமையாகப் பாதுகாப்பானது அல்ல, எனவே உங்கள் கடவுச்சொல்லை ரகசியமாக வைத்திருங்கள்.'],
      ],
    },
    refunds: {
      title: 'பணத்திருப்பம் மற்றும் ரத்து கொள்கை',
      sections: [
        ['பணம் செலுத்துவதற்கு முன்', 'நீங்கள் பணம் செலுத்தும் வரை ஆர்டரை இலவசமாக ரத்து செய்யலாம். வேறு ஃப்ரீலான்ஸரைத் தேர்ந்தெடுக்க வேலை மீண்டும் திறக்கப்படும்.'],
        ['பணம் செலுத்திய பின், வழங்குவதற்கு முன்', 'உங்கள் பணம் பாதுகாப்பாக வைக்கப்பட்டுள்ளது. ஃப்ரீலான்ஸரால் வழங்க முடியவில்லை என்றால், எங்களுக்கு மின்னஞ்சல் அனுப்புங்கள்; உங்கள் அசல் பணம் செலுத்தும் முறைக்கு முழுத் தொகையையும் திருப்பித் தருவோம்.'],
        ['வழங்கிய பின்', 'வேலையைச் சரிபாருங்கள். நீங்கள் ஏற்றதும் பணம் ஃப்ரீலான்ஸருக்கு விடுவிக்கப்படும்; அதைத் திரும்பப் பெற முடியாது. ஒப்புக்கொண்டபடி வேலை இல்லையென்றால் ஏற்க வேண்டாம்; எங்களுக்கு மின்னஞ்சல் அனுப்புங்கள்.'],
        ['பணத்திருப்பம் எப்படி வழங்கப்படும்', 'ஒப்புக்கொள்ளப்பட்ட பணத்திருப்பம் Razorpay மூலம் அசல் பணம் செலுத்தும் முறைக்குச் செல்லும். வங்கிகள் பொதுவாக 5 முதல் 7 வேலை நாட்கள் எடுக்கும்.'],
        ['தகராறுகள்', 'ஆர்டர் விவரங்கள் மற்றும் செய்திகள் அல்லது கோப்புகளுடன் எங்களுக்கு மின்னஞ்சல் அனுப்புங்கள். இரு தரப்பையும் பரிசீலித்து, வாடிக்கையாளருக்குப் பணத்தைத் திருப்புவதா அல்லது ஃப்ரீலான்ஸருக்கு விடுவிப்பதா என்று முடிவு செய்வோம்.'],
      ],
    },
    contact: { title: 'எங்களைத் தொடர்பு கொள்ளுங்கள்', sections: [['உதவ நாங்கள் இருக்கிறோம்', 'ஆர்டர், பணம் செலுத்தல், உங்கள் கணக்கு அல்லது இந்தக் கொள்கைகளில் உள்ள எதைப் பற்றியும் எங்களுக்கு எழுதுங்கள்.']] },
  },
};
