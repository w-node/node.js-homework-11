const fs        = require('fs');
const path      = require('path');
const Router    = require('koa-router');
const User      = require('./models/user');
const Message   = require('./models/message');
const BlackToken= require('./models/blacktoken');
// const checkAuth = require('./middlewares/authLocal');
const passport  = require('koa-passport');
const genTokens = require('./controllers/generateTokens');

passport.use('local', require('./strategies/local'));
passport.use('jwt', require('./strategies/jwt'));

const apiRouter = new Router({
    prefix: '/api/v1'
});

const router = new Router();


router.get('/', passport.authenticate('jwt', {
    session: false,
    failureRedirect: '/signin'
}), ctx => {

    /*if (!user) {
        return ctx.redirect('/signin');
    }*/

    ctx.type = 'html';
    ctx.body = fs.createReadStream(path.join(__dirname, '../../static/home.html'));
});


router.get('/signin', /*checkAuth,*/ ctx => {
    ctx.type = 'html';
    ctx.body = fs.createReadStream(path.join(__dirname, '../../static/signin.html'));
});

router.get('/signup', /*checkAuth,*/ ctx => {
    ctx.type = 'html';
    ctx.body = fs.createReadStream(path.join(__dirname, '../../static/signup.html'));
});

apiRouter.get('/users', passport.authenticate('jwt', {session: false}), async ctx => {
    ctx.type = 'json';
    ctx.body = await User.find();
});

apiRouter.post('/signup', async ctx => {
    const user = new User(ctx.request.body);

    await user.save();

    ctx.redirect('/signin');
});

apiRouter.post('/signin', async ctx => {
    await passport.authenticate('local', async (err, user, info, status) => {
        if (err) {
            return ctx.throw(err);
        }

        if (!user) {
            return ctx.throw(500, info);
        }

        const tokens = genTokens(user);

        ctx.cookies.set('x-access-token', tokens.access_token, {
            expires: new Date(Date.now() + 5 * 60 * 1000), // время жизни токена
            secure: ctx.secure,
            httpOnly: true,
            signed: true,
            origin: (new URL(ctx.href)).origin
        });

        ctx.cookies.set('x-refresh-token', tokens.refresh_token, {
            expires: new Date(Date.now() + 86400 * 60 * 1000), // время жизни refresh токена
            secure: ctx.secure,
            httpOnly: true,
            signed: true,
            origin: (new URL(ctx.href)).origin
        });

        // ctx.type = 'json';
        // ctx.body = tokens;

        ctx.redirect('/');
    })(ctx);
});

apiRouter.get('/messages', async ctx => {
    ctx.type = 'json';
    if (ctx.query.withUser) {
        ctx.body = await Message.find().populate('user_id');
    } else {
        ctx.body = await Message.find().lean().exec();
    }
});

apiRouter.post('/messages', /*checkAuth,*/ async ctx => {
    const message = new Message({
        message: ctx.request.body.message,
        user_id: user._id
    });

    await message.save();

    ctx.redirect('/');
});

apiRouter.post('/signout', passport.authenticate('jwt', {session: false}), async ctx => {
    const access_token  = ctx.headers['x-access-token'] || ctx.query.access_token || ctx.cookies.get('x-access-token');
    const refresh_token = ctx.headers['x-refresh-token'] || ctx.query.refresh_token || ctx.cookies.get('x-refresh-token');

    const blackAccessToken = new BlackToken({token: access_token});
    const blackRefreshToken = new BlackToken({token: refresh_token});

    await Promise.all([blackAccessToken.save(), blackRefreshToken.save()]);

    ctx.cookies.set('x-access-token', null);
    ctx.cookies.set('x-refresh-token', null);

    ctx.redirect('/signin');
});

router.get('/me', passport.authenticate('jwt', {session: false}), async ctx => {
    ctx.type = 'json';
    ctx.body = ctx.state.user;
});

router.get('/chat', passport.authenticate('jwt', {session: false}), async ctx => {
    const user = ctx.state.user;

    const messages = await Message.find({user_id: user._id});

    ctx.render(__dirname + '/../../tmpl/index.pug', {
        messages: messages,
        moment: require('moment')
    });
});

apiRouter.post('/chat', passport.authenticate('jwt', {session: false}), async ctx => {

    if (ctx.request.body.message.length > 0) {
        const user = ctx.state.user;

        const message = new Message({
            message: ctx.request.body.message,
            user_id: user._id,
            time: new Date()
        });

        await message.save();
    }

    ctx.redirect('/chat');
});

apiRouter.get('/refresh-tokens', require('./controllers/refreshTokens'));


module.exports = [
    router,
    apiRouter
];