const request = require('supertest');
const app = require('./src/service');
const path = require('path');
const fs = require('fs');

const { Role, DB } = require('./src/database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
  }

test('Register', async () => {
    const connection = await DB.getConnection();

    try {
        await DB.initializeDatabase();
        // Drop the database
        await connection.query('DROP DATABASE pizza');
        await DB.initializeDatabase();

        const result1 = await connection.query("SHOW DATABASES LIKE 'pizza'");
        expect(result1.length).toBeGreaterThan(0);
    } finally {
        connection.end();
    }

    const getRegRes = await request(app).post('/api/auth').send({
        name: "John Doe",
        email: "johndoe@example.com",
        password: "securepassword123"
    }).set('Content-Type', 'application/json');
    expect(getRegRes.status).toBe(200);
    expect(getRegRes.headers['content-type']).toMatch('application/json; charset=utf-8');
  });

  test('Register Fail', async () => {
    const getRegRes = await request(app).post('/api/auth').send({
        name: "John Doe",
        email: "johndoe@example.com"
    }).set('Content-Type', 'application/json');
    expect(getRegRes.status).toBe(400);
    expect(getRegRes.headers['content-type']).toMatch('application/json; charset=utf-8');
  });

  test('Login/Logout/update', async () => {
    const user = await createAdminUser();
    
    const getLoginRes = await request(app).put('/api/auth').send({
        email: user.email,
        password: user.password
    }).set('Content-Type', 'application/json');
    expect(getLoginRes.status).toBe(200);
    expect(getLoginRes.headers['content-type']).toMatch('application/json; charset=utf-8');

    const token = getLoginRes.body.token;

    const getRegRes = await request(app).post('/api/auth').send({
        name: randomName(),
        email: "johndoe@example.com",
        password: "securepassword123"
    }).set('Content-Type', 'application/json');

    const getUpdateRes = await request(app).put(`/api/auth/${getRegRes.body.user.id}`).send({
        email: "getLoginRes.email",
        password: "getLoginRes.password"
    }).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(getUpdateRes.status).toBe(200);
    expect(getUpdateRes.headers['content-type']).toMatch('application/json; charset=utf-8');

    const getLogoutRes = await request(app).delete('/api/auth').set(
        'Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(getLogoutRes.status).toBe(200);
    expect(getLogoutRes.headers['content-type']).toMatch('application/json; charset=utf-8');

  });

  test('Failed Login', async () => {
    const getLoginRes = await request(app).put('/api/auth').send({
        email: "johndon@example.com",
        password: "securepassword123"
    }).set('Content-Type', 'application/json');
    expect(getLoginRes.status).toBe(404);
    expect(getLoginRes.headers['content-type']).toMatch('application/json; charset=utf-8');
  });

  test('Create/Delete Franchise', async () => {

    const user = await createAdminUser();

    const getLoginRes = await request(app).put('/api/auth').send({
        email: user.email,
        password: user.password
    }).set('Content-Type', 'application/json');

    const token = getLoginRes.body.token

    const getFranRes = await request(app).post('/api/franchise').send({
        name: randomName(), 
        admins: [{"email": user.email}]
    }).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(getFranRes.status).toBe(200);
    expect(getFranRes.headers['content-type']).toMatch('application/json; charset=utf-8');

    const franId = getFranRes.body.id;

    const createFranStore = await request(app).post(`/api/franchise/${franId}/store`).send({
        franchiseID: franId,
        name: randomName()
    }).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(createFranStore.status).toBe(200);
    expect(createFranStore.headers['content-type']).toMatch('application/json; charset=utf-8');

    const storeID = createFranStore.body.id;

    //bad delete

    const getRegRes = await request(app).post('/api/auth').send({
        name: randomName(),
        email: randomName() + "@random.com",
        password: "securepassword123"
    }).set('Content-Type', 'application/json');

    const badUserToken = getRegRes.body.token

    const badDelStore = await request(app).delete(`/api/franchise/${franId}/store/${storeID}`).set('Authorization',  `Bearer ${badUserToken}`).set(
        'Content-Type', 'application/json');
    expect(badDelStore.status).toBe(403);
    expect(badDelStore.headers['content-type']).toMatch('application/json; charset=utf-8');

    const badDelFran = await request(app).delete(`/api/franchise/${franId}`).set('Authorization',  `Bearer ${badUserToken}`).set(
        'Content-Type', 'application/json');
    expect(badDelFran.status).toBe(403);
    expect(badDelFran.headers['content-type']).toMatch('application/json; charset=utf-8');

    //Good delete

    const delStore = await request(app).delete(`/api/franchise/${franId}/store/${storeID}`).set('Authorization',  `Bearer ${token}`).set(
        'Content-Type', 'application/json');
    expect(delStore.status).toBe(200);
    expect(delStore.headers['content-type']).toMatch('application/json; charset=utf-8');

    const delFran = await request(app).delete(`/api/franchise/${franId}`).set('Authorization',  `Bearer ${token}`).set(
        'Content-Type', 'application/json');
    expect(delFran.status).toBe(200);
    expect(delFran.headers['content-type']).toMatch('application/json; charset=utf-8');





  })

  test('Create Franchise FAIL', async () => {

    const user = await createAdminUser();

    const getRegRes = await request(app).post('/api/auth').send({
        name: randomName(),
        email: randomName() + "@random.com",
        password: "securepassword123"
    }).set('Content-Type', 'application/json');

    const token = getRegRes.body.token

    const getFranRes = await request(app).post('/api/franchise').send({
        name: randomName(), 
        admins: [{"email": user.email}]
    }).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(getFranRes.status).toBe(403);
    expect(getFranRes.headers['content-type']).toMatch('application/json; charset=utf-8');

    const getLoginRes = await request(app).put('/api/auth').send({
        email: user.email,
        password: user.password
    }).set('Content-Type', 'application/json');

    const getFranResFail = await request(app).post('/api/franchise').send({
        name: randomName(), 
        admins: [{"email": "bad email"}]
    }).set('Authorization',  `Bearer ${getLoginRes.body.token}`).set('Content-Type', 'application/json');
    expect(getFranResFail.status).toBe(404);
    expect(getFranResFail.headers['content-type']).toMatch('application/json; charset=utf-8');

  })

test('Franchise', async () => {

    const user = await createAdminUser();

    const getLoginRes = await request(app).put('/api/auth').send({
        email: user.email,
        password: user.password
    }).set('Content-Type', 'application/json');

    const token = getLoginRes.body.token;
    const id = getLoginRes.body.id;

    const userFran = await request(app).get(`/api/franchise/${id}`).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(userFran.status).toBe(200);
    expect(userFran.headers['content-type']).toMatch('application/json; charset=utf-8');

    const getFranRes = await request(app).get('/api/franchise').set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(getFranRes.status).toBe(200);
    expect(getFranRes.headers['content-type']).toMatch('application/json; charset=utf-8');


  });


  test('Menu', async () => {
    const getMenu = await request(app).get('/api/order/menu');
    expect(getMenu.status).toBe(200);
    expect(getMenu.headers['content-type']).toMatch('application/json; charset=utf-8');


    const user = await createAdminUser();

    const getLoginRes = await request(app).put('/api/auth').send({
        email: user.email,
        password: user.password
    }).set('Content-Type', 'application/json');

    token = getLoginRes.body.token;

    const filePath = path.join(__dirname, './picture.png');

    const addMenuItem = await request(app).put('/api/order/menu').send({
        title: "carrot",
        description: 'test description',
        image: fs.createReadStream(filePath),
        price: 0.001
    }).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(addMenuItem.status).toBe(200);
    expect(addMenuItem.headers['content-type']).toMatch('application/json; charset=utf-8');

    const addMenuItemFail = await request(app).put('/api/order/menu').send({
        title: "carrot",
        description: 'test description',
        image: fs.createReadStream(filePath),
    }).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(addMenuItemFail.status).toBe(500);
    expect(addMenuItemFail.headers['content-type']).toMatch('application/json; charset=utf-8');

    const getRegRes = await request(app).post('/api/auth').send({
        name: randomName(),
        email: randomName() + "@random.com",
        password: "securepassword123"
    }).set('Content-Type', 'application/json');

    const notAdminToken = getRegRes.body.token

    const addMenuItemFail2 = await request(app).put('/api/order/menu').send({
        title: "carrot",
        description: 'test description',
        image: fs.createReadStream(filePath),
        price: 0.001
    }).set('Authorization',  `Bearer ${notAdminToken}`).set('Content-Type', 'application/json');
    expect(addMenuItemFail2.status).toBe(403);
    expect(addMenuItemFail2.headers['content-type']).toMatch('application/json; charset=utf-8');

    // {"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}


    const addOrder = await request(app).post('/api/order').send({
        franchiseId: 1,
        storeId: 1,
        items: [{
            menuId: addMenuItem.body.id || 1,
            description: addMenuItem.body.description || 'Fallback description',
            price: addMenuItem.body.price || 0.05,}],
    }).set('Authorization',  `Bearer ${token}`).set('Content-Type', 'application/json');
    expect(addOrder.status).toBe(200);
    expect(addOrder.headers['content-type']).toMatch('application/json; charset=utf-8');

    const addOrderFail = await request(app).post('/api/order').send({
        franchiseId: 1,
        storeId: 1,
        items: [{
            menuId: addMenuItem.body.id || 1,
            description: addMenuItem.body.description || 'Fallback description',
            price: addMenuItem.body.price || 0.05,}],
    }).set('Authorization',  `Bearer bad Token`).set('Content-Type', 'application/json');
    expect(addOrderFail.status).toBe(401);
    expect(addOrderFail.headers['content-type']).toMatch('application/json; charset=utf-8');
  });

  test('Retrieve Order', async () => {
    const user = await createAdminUser();

    const getLoginRes = await request(app).put('/api/auth').send({
        email: user.email,
        password: user.password
    }).set('Content-Type', 'application/json');

    const token = getLoginRes.body.token;

    const addOrder = await request(app).post('/api/order').send({
        franchiseId: 1,
        storeId: 1,
        items: [{
            menuId: 1,
            description: 'Test Order',
            price: 10.00
        }],
    }).set('Authorization', `Bearer ${token}`).set('Content-Type', 'application/json');

    expect(addOrder.status).toBe(200);
    expect(addOrder.headers['content-type']).toMatch('application/json; charset=utf-8');

    const orderId = addOrder.body.id;

    const getOrder = await request(app).get(`/api/order/`)
        .set('Authorization', `Bearer badToken`)
        .set('Content-Type', 'application/json');

    expect(getOrder.status).toBe(401);
    expect(getOrder.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(getOrder.body.id).toBe(orderId);
});


// test('Drop Database', async () => {
//     // Ensure the database connection is available

// });
