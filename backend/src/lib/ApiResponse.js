export const ok = (res, data, message = 'OK', statusCode = 200) =>
    res.status(statusCode).json({ success: true, message, data });

export const created = (res, data, message = 'Created') => ok(res, data, message, 201);

export const noContent = (res) => res.status(204).end();
