import mongoose from "mongoose";

const headerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    },
    url: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

const HeaderModel = mongoose.model('header', headerSchema);

export default HeaderModel;
