import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const p = (rupees: number) => Math.round(rupees * 100);

type V = [label: string, price: number, mrp?: number];
type P = { name: string; desc: string; group?: string; variants: V[]; featured?: boolean; pop?: number; prep?: number; rx?: boolean };

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const owners: Record<string, string> = {}; // id -> slug, so product slugs are readable and unique

async function addProducts(categoryId: string, shopId: string | null, list: P[]) {
  for (const item of list) {
    const slug = slugify(`${item.name}-${owners[shopId ?? categoryId]}`);
    await db.product.upsert({
      where: { slug },
      update: {},
      create: {
        slug, name: item.name, description: item.desc, categoryId, shopId, group: item.group ?? null,
        isFeatured: !!item.featured, popularity: item.pop ?? 0, prepTimeMin: item.prep ?? null, requiresPrescription: !!item.rx,
        variants: { create: item.variants.map(([label, price, mrp], i) => ({ label, pricePaise: p(price), mrpPaise: mrp ? p(mrp) : null, sortOrder: i, stockQty: 200 })) },
      },
    });
  }
}

async function main() {
  // ---- Categories ----
  const cats = [
    { slug: 'food', name: 'Food Delivery', emoji: '🍛', tagline: 'Hot meals from local kitchens', sortOrder: 1 },
    { slug: 'groceries', name: 'Groceries', emoji: '🧺', tagline: 'Pantry staples and daily needs', sortOrder: 2 },
    { slug: 'vegetables', name: 'Vegetables', emoji: '🥬', tagline: 'Fresh, priced daily', sortOrder: 3 },
    { slug: 'meat', name: 'Chicken & Meat', emoji: '🍗', tagline: 'Chicken, mutton and eggs', sortOrder: 4 },
    { slug: 'medicine', name: 'Medicine Delivery', emoji: '💊', tagline: 'Through an authorised pharmacy', sortOrder: 5 },
  ];
  const cat: Record<string, string> = {};
  for (const c of cats) {
    cat[c.slug] = (await db.category.upsert({ where: { slug: c.slug }, update: {}, create: c })).id;
    owners[cat[c.slug]!] = c.slug;
  }

  // ---- Admin user (from env; never commit real credentials) ----
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-before-seeding';
  await db.user.upsert({
    where: { email },
    update: {},
    create: { name: 'PDVB Admin', email, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) },
  });

  // ---- Delivery zones (replace with your real PIN codes in Admin or SEED_PINCODES) ----
  for (const pin of (process.env.SEED_PINCODES ?? '110001,110002').split(',').map((s) => s.trim()).filter(Boolean)) {
    await db.deliveryZone.upsert({ where: { pincode: pin }, update: {}, create: { pincode: pin, label: 'Sample zone' } });
  }

  // ---- Coupons ----
  await db.coupon.upsert({ where: { code: 'WELCOME50' }, update: {}, create: { code: 'WELCOME50', description: '₹50 off orders above ₹300', type: 'FLAT', value: p(50), minOrderPaise: p(300), usageLimit: 500 } });
  await db.coupon.upsert({ where: { code: 'SAVE10' }, update: {}, create: { code: 'SAVE10', description: '10% off, up to ₹100', type: 'PERCENT', value: 10, maxDiscountPaise: p(100), minOrderPaise: p(500) } });

  // ---- Food shops (placeholder names; rename in Admin > Shops) ----
  const shops = [
    { slug: 'biryani-shop-1', name: 'Biryani Shop 1', description: 'Dum biryani, cooked to order.', eta: 40 },
    { slug: 'biryani-shop-2', name: 'Biryani Shop 2', description: 'Hyderabadi-style biryani and kebabs.', eta: 45 },
    { slug: 'biryani-shop-3', name: 'Biryani Shop 3', description: 'Family packs and party orders.', eta: 50 },
    { slug: 'meals-shop', name: 'Meals Shop', description: 'Full meals, chapati and fried rice.', eta: 35 },
    { slug: 'tiffin-shop', name: 'Tiffin Shop', description: 'Idli, dosa and vada, fresh each morning.', eta: 25 },
  ];
  const shopId: Record<string, string> = {};
  for (const s of shops) {
    shopId[s.slug] = (await db.shop.upsert({
      where: { slug: s.slug }, update: {},
      create: { slug: s.slug, name: s.name, description: s.description, categoryId: cat.food, deliveryEtaMin: s.eta, opensAt: '10:00', closesAt: '22:30', minOrderPaise: p(150) },
    })).id;
    owners[shopId[s.slug]!] = s.slug;
  }
  const biryani = (extra = 0): P[] => [
    { name: 'Chicken Biryani', desc: 'Basmati rice layered with marinated chicken.', group: 'Biryani', variants: [['Half', 140 + extra], ['Full', 240 + extra]], featured: true, pop: 90, prep: 30 },
    { name: 'Mutton Biryani', desc: 'Slow-cooked mutton with aromatic rice.', group: 'Biryani', variants: [['Half', 210 + extra], ['Full', 360 + extra]], pop: 70, prep: 35 },
    { name: 'Veg Biryani', desc: 'Seasonal vegetables and whole spices.', group: 'Biryani', variants: [['Half', 110 + extra], ['Full', 190 + extra]], pop: 40, prep: 25 },
  ];
  await addProducts(cat.food, shopId['biryani-shop-1'], biryani());
  await addProducts(cat.food, shopId['biryani-shop-2'], biryani(10));
  await addProducts(cat.food, shopId['biryani-shop-3'], biryani(-10));
  await addProducts(cat.food, shopId['meals-shop'], [
    { name: 'Meals (Veg)', desc: 'Rice, sambar, rasam, two curries, curd, pickle.', group: 'Meals', variants: [['Regular', 100], ['Large', 140]], featured: true, pop: 80, prep: 20 },
    { name: 'Chapati', desc: 'Soft whole-wheat chapati, set of 3.', group: 'Breads', variants: [['3 pcs', 45]], pop: 50, prep: 15 },
    { name: 'Fried Rice', desc: 'Wok-tossed rice with vegetables.', group: 'Rice', variants: [['Veg', 120], ['Egg', 140], ['Chicken', 170]], pop: 55, prep: 20 },
  ]);
  await addProducts(cat.food, shopId['tiffin-shop'], [
    { name: 'Idli', desc: 'Steamed rice cakes with sambar and chutney.', group: 'Tiffin', variants: [['2 pcs', 40], ['4 pcs', 70]], pop: 85, prep: 10 },
    { name: 'Dosa', desc: 'Crisp plain dosa with chutneys.', group: 'Tiffin', variants: [['Plain', 50], ['Masala', 70]], featured: true, pop: 75, prep: 12 },
    { name: 'Vada', desc: 'Crisp medu vada, set of 2.', group: 'Tiffin', variants: [['2 pcs', 40]], pop: 45, prep: 10 },
  ]);

  // ---- Groceries (44 products) ----
  const G = (group: string, rows: [string, string, V[]][]): P[] => rows.map(([name, desc, variants]) => ({ name, desc, group, variants }));
  const groceries: P[] = [
    ...G('Rice and grains', [
      ['Sona Masoori Rice', 'Everyday medium-grain rice.', [['5 kg', 320, 350], ['10 kg', 610, 680]]],
      ['Basmati Rice', 'Long-grain aged basmati.', [['1 kg', 130, 150], ['5 kg', 620]]],
      ['Wheat Flour (Atta)', 'Stone-ground whole wheat atta.', [['5 kg', 230, 250], ['10 kg', 440]]],
      ['Poha', 'Thick flattened rice.', [['500 g', 45]]],
    ]),
    ...G('Dals and pulses', [
      ['Toor Dal', 'Unpolished arhar dal.', [['1 kg', 165, 180]]],
      ['Moong Dal', 'Split yellow moong dal.', [['1 kg', 140]]],
      ['Chana Dal', 'Split Bengal gram.', [['1 kg', 105]]],
      ['Urad Dal', 'Split black gram.', [['1 kg', 150, 160]]],
    ]),
    ...G('Cooking oils', [
      ['Sunflower Oil', 'Refined sunflower oil.', [['1 L', 135, 150], ['5 L', 650]]],
      ['Groundnut Oil', 'Cold-filtered groundnut oil.', [['1 L', 190]]],
      ['Ghee', 'Pure cow ghee.', [['500 ml', 330, 360]]],
    ]),
    ...G('Dairy products', [
      ['Full Cream Milk', 'Pasteurised full cream milk.', [['500 ml', 34], ['1 L', 66]]],
      ['Curd', 'Fresh set curd.', [['400 g', 38]]],
      ['Butter', 'Salted table butter.', [['100 g', 58], ['500 g', 275]]],
      ['Paneer', 'Soft fresh paneer.', [['200 g', 85]]],
      ['Bread', 'Sandwich bread loaf.', [['400 g', 45]]],
    ]),
    ...G('Snacks and packaged food', [
      ['Glucose Biscuits', 'Classic tea-time biscuits.', [['200 g', 20]]],
      ['Instant Noodles', 'Masala instant noodles.', [['4-pack', 56, 60]]],
      ['Salted Chips', 'Crispy potato chips.', [['90 g', 30]]],
      ['Peanut Chikki', 'Jaggery and peanut bar.', [['200 g', 60]]],
    ]),
    ...G('Beverages', [
      ['Tea Powder', 'Strong CTC tea.', [['250 g', 120, 135], ['500 g', 230]]],
      ['Instant Coffee', 'Instant coffee powder.', [['100 g', 240, 265]]],
      ['Mango Juice', 'Ready-to-drink mango juice.', [['1 L', 105]]],
      ['Packaged Drinking Water', 'Sealed mineral water.', [['1 L', 20], ['20 L can', 70]]],
    ]),
    ...G('Spices', [
      ['Salt', 'Iodised crystal salt.', [['1 kg', 25]]],
      ['Turmeric Powder', 'Pure haldi powder.', [['200 g', 55]]],
      ['Red Chilli Powder', 'Medium-hot chilli powder.', [['200 g', 70]]],
      ['Coriander Powder', 'Freshly ground dhania.', [['200 g', 48]]],
      ['Garam Masala', 'Blended whole-spice masala.', [['100 g', 85]]],
    ]),
    ...G('Personal care', [
      ['Bathing Soap', 'Moisturising bath soap.', [['3 x 100 g', 120, 135]]],
      ['Shampoo', 'Daily-care shampoo.', [['340 ml', 215, 250]]],
      ['Toothpaste', 'Fluoride toothpaste.', [['150 g', 98, 105]]],
      ['Toothbrush', 'Medium-bristle toothbrush.', [['2 pcs', 60]]],
    ]),
    ...G('Household cleaning', [
      ['Detergent Powder', 'Top-load and hand-wash powder.', [['1 kg', 110, 125]]],
      ['Dishwash Liquid', 'Lemon dishwash liquid.', [['500 ml', 99]]],
      ['Floor Cleaner', 'Disinfectant floor cleaner.', [['1 L', 175]]],
    ]),
    ...G('Daily essentials', [
      ['Sugar', 'Fine white sugar.', [['1 kg', 48]]],
      ['Onions', 'Fresh red onions.', [['1 kg', 38]]],
      ['Potatoes', 'Table potatoes.', [['1 kg', 32]]],
      ['Tomatoes', 'Ripe country tomatoes.', [['1 kg', 30]]],
      ['Garlic', 'Fresh garlic bulbs.', [['250 g', 40]]],
      ['Ginger', 'Fresh ginger.', [['250 g', 28]]],
    ]),
  ];
  groceries[0]!.featured = true; groceries[4]!.featured = true; groceries[11]!.featured = true;
  await addProducts(cat.groceries, null, groceries);

  // ---- Vegetables (daily prices: update in Admin) ----
  const veg = (group: string, rows: [string, string, V[]][]): P[] => rows.map(([name, desc, variants]) => ({ name, desc, group, variants }));
  await addProducts(cat.vegetables, null, [
    ...veg('Leafy vegetables', [
      ['Spinach', 'Tender palak leaves.', [['1 bunch', 20]]],
      ['Coriander', 'Fresh coriander leaves.', [['1 bunch', 15]]],
      ['Fenugreek (Methi)', 'Fresh methi bunch.', [['1 bunch', 20]]],
      ['Curry Leaves', 'Fresh curry leaves.', [['50 g', 10]]],
    ]),
    ...veg('Daily-use vegetables', [
      ['Potatoes', 'Fresh potatoes.', [['500 g', 18], ['1 kg', 34]]],
      ['Onions', 'Red onions.', [['500 g', 20], ['1 kg', 38]]],
      ['Tomatoes', 'Ripe tomatoes.', [['500 g', 16], ['1 kg', 30]]],
      ['Carrots', 'Crunchy orange carrots.', [['500 g', 30], ['1 kg', 58]]],
      ['Green Chillies', 'Hot green chillies.', [['100 g', 10]]],
    ]),
    ...veg('Seasonal vegetables', [
      ['Beans', 'Tender French beans.', [['500 g', 35], ['1 kg', 68]]],
      ['Brinjal', 'Purple brinjal.', [['500 g', 25]]],
      ['Cauliflower', 'Fresh white cauliflower.', [['1 piece', 35]]],
      ['Drumstick', 'Tender drumsticks.', [['250 g', 28]]],
    ]),
  ]);

  // ---- Chicken, meat and eggs ----
  await addProducts(cat.meat, null, [
    { name: 'Whole Chicken', desc: 'Farm-fresh whole chicken, with skin.', group: 'Chicken', variants: [['1 kg', 240], ['1.5 kg', 355]], featured: true, prep: 30 },
    { name: 'Skinless Chicken', desc: 'Skinless, cleaned chicken.', group: 'Chicken', variants: [['500 g', 150], ['1 kg', 290]], prep: 30 },
    { name: 'Chicken Curry Cut', desc: 'Medium curry-cut pieces with bone.', group: 'Chicken', variants: [['500 g', 130], ['1 kg', 250]], pop: 80, prep: 30 },
    { name: 'Chicken Boneless', desc: 'Boneless chicken pieces.', group: 'Chicken', variants: [['500 g', 190]], prep: 30 },
    { name: 'Mutton Curry Cut', desc: 'Fresh goat meat, curry cut.', group: 'Mutton and other meats', variants: [['500 g', 380], ['1 kg', 750]], prep: 40 },
    { name: 'Mutton Boneless', desc: 'Boneless mutton.', group: 'Mutton and other meats', variants: [['500 g', 480]], prep: 40 },
    { name: 'Eggs', desc: 'Farm eggs.', group: 'Eggs', variants: [['6 pcs', 42], ['12 pcs', 80], ['Tray of 30', 190, 205]], pop: 95 },
  ]);

  // ---- Medicine: only non-prescription placeholders; checkout stays disabled until authorised ----
  await addProducts(cat.medicine, null, [
    { name: 'Paracetamol 500 mg', desc: 'Pain and fever relief (OTC).', group: 'Over the counter', variants: [['Strip of 15', 28]] },
    { name: 'ORS Sachet', desc: 'Oral rehydration salts.', group: 'Over the counter', variants: [['1 sachet', 22]] },
    { name: 'Antibiotic (sample, prescription only)', desc: 'Placeholder for a prescription medicine. Requires pharmacist verification.', group: 'Prescription', variants: [['Strip', 120]], rx: true },
  ]);

  console.log('Seed complete.');
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
