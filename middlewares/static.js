const serve = require('koa-static');
const path  = require('path');

module.exports = async (ctx, next) => {
    const staticPath = path.join(__dirname, '../static');

    if (ctx.request.url.startsWith('/bootstrap.css')) {
        return serve(path.join(__dirname, '../node_modules/bootstrap/dist/css/'), {
            maxAge: 0,
            gzip: true
        })(ctx, next);
    }

    return serve(staticPath, {
        maxAge: 0,
        gzip: true
    })(ctx, next);
};
