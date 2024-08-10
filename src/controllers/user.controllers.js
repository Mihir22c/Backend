import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'


const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateRefreshToken()
        const refreshToken = user.generateAccessToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation
    // check if user already exist: username, email
    // check for images, avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation


    const { fullName, email, username, password } = req.body
    // console.log('fullName, email, username, password', fullName, email, username, password);
    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({ $or: [{ username }, { email }] })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);


    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files?.coverImage[0]?.path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    // upload to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar is required")
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser) {
        throw new ApiError(500, "User registration failed")
    }

    return res.status(201).json(new ApiResponse(200, "User registered successfully", createdUser))

})

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // get username or email from frontend
    // get password from frontend
    // check if user exist
    // compare password
    // generate access or refresh token
    // send cookie/token to frontend
    // send user details to frontend
    const { email, username, password } = req.body
    if (!username || !email) {
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    })
    if (!user) {
        throw new ApiError(404, "User not found")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Password is incorrect")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const cookieOptions = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie("accessToken", accessToken, cookieOptions).cookie("refreshToken", cookieOptions).json(
        new ApiResponse(200, "User logged in successfully", { user: loggedInUser, accessToken, refreshToken })
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshToken: undefined } },
        { new: true }
    )
    const cookieOptions = {
        httpOnly: true,
        secure: true
    }
    return res.status(200).clearCookie("accessToken", cookieOptions).clearCookie("refreshToken", cookieOptions).json(
        new ApiResponse(200, "User logged out successfully")
    )
})

export { registerUser, loginUser }