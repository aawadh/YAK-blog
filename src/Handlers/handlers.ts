import { GraphQLID, GraphQLList,GraphQLNonNull,GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
import Blog from "../Models/Blog";
import User from "../Models/User";
import Comment from "../Models/Comment";
import { CommentType, BlogType, UserType } from "../schema/schema";
import { Document, startSession } from "mongoose";
import { hashSync, compareSync } from "bcryptjs";
import { resolve } from "path";

type DocumentType = Document<any,any,any>;

const RootQuery = new GraphQLObjectType({
    name: "RootQuery",
    fields: {
        users: {
            type: GraphQLList(UserType),
            async resolve() {
                return await User.find();
            }
        },
        user: {
            type: UserType,
            args:{id:{type:GraphQLNonNull(GraphQLID)}},
            async resolve(parent, {id}){
                return (await User.findById(id)).populate("blogs");
            },
        },
        blogs: {
            type: GraphQLList(BlogType),
            async resolve() {
                return await Blog.find();
            }
        },
        blog: {
            type: BlogType,
            args: { id:{ type: GraphQLNonNull(GraphQLID) } },
            async resolve(parent, { id }) {
                return await Blog.findById(id).populate("user");
            }
        },
        comments: {
            type: GraphQLList(CommentType),
            async resolve() {
                return await Comment.find();
            }
        },
    },
});

const mutations = new GraphQLObjectType({
    name: "mutations",
    fields: {
        signup: {
            type: UserType,
            args: {
                name: { type: GraphQLNonNull(GraphQLString) },
                email: { type: GraphQLNonNull(GraphQLString) },
                password: { type: GraphQLNonNull(GraphQLString) },
            },
            async resolve(parent,{name, email, password}) {
                let existingUser: Document<any,any,any>;
                try {
                    existingUser = await User.findOne({ email });
                    if(existingUser) return new Error("User Already Exists");
                    const encryptedPassword = hashSync(password);
                    const user = new User({name, email, password: encryptedPassword});
                    return await user.save();
                } catch (err) {
                    return new Error("User Signup Failed. Try Again");
                }
            },
        },
        login: {
            type: UserType,
            args:{
                email: { type:GraphQLNonNull(GraphQLString) },
                password: { type:GraphQLNonNull(GraphQLString) },
            },
            async resolve(parent,{email,password}) {
                let existingUser: Document<any, any, any>;
                try {
                    existingUser = await User.findOne({ email });
                    if(!existingUser) return new Error("No User Registered With This Email");
                    const decryptedPassword = compareSync(
                        password, 
                        // @ts-ignore
                        existingUser?.password
                        );
                        if(!decryptedPassword) return new Error("Incorrect Password");
                        return existingUser;
                }catch(err){
                    return new Error(err);
                }
            },
        },
        addBlog: {
            type :BlogType,
            args: {
                title: { type: GraphQLNonNull(GraphQLString) },
                content: { type: GraphQLNonNull(GraphQLString) },
                date: { type: GraphQLNonNull(GraphQLString) },
                user: { type:GraphQLNonNull(GraphQLID) },
            },
            async resolve(parent, { title, content ,date, user }) {
                let blog: DocumentType;
                const session = await startSession();
                try { 
                    session.startTransaction({ session });
                    blog = new Blog({ title, content, date, user });
                    const existingUser = await User.findById(user);
                    if(!existingUser) return new Error("User Not Found");
                    existingUser.blogs.push(blog);
                    await existingUser.save({ session });
                    return await blog.save({ session });
                 } catch (err){
                    return new Error(err);
                }finally{
                    await session.commitTransaction();
                }
            },
        },
        updateBlog: {
            type: BlogType,
            args: {
                id: { type: GraphQLNonNull(GraphQLID) },
                title: { type: GraphQLNonNull(GraphQLString) },
                content: { type: GraphQLNonNull(GraphQLString) },
            },
            async resolve(parent, {id,title,content}) {
                let existingBlog : DocumentType;
                try {
                    existingBlog = await Blog.findById(id);
                    if(!existingBlog) return new Error("Blog does not exist");
                    return await Blog.findByIdAndUpdate(id,{
                        title,
                        content,
                    },{ new: true });
                } catch (err) {
                    return new Error(err);
                }

            }
        },
        deleteBlog: {
            type: BlogType,
            args: {
                id: { type: GraphQLNonNull(GraphQLID) },
            },
            async resolve(parent, { id }) {
                let existingBlog: DocumentType;
                const session = await startSession();
                try {
                    session.startTransaction({ session });
                    existingBlog = await (await Blog.findById(id)).populate("user");
                    //@ts-ignore
                    const existingUser = existingBlog?.user;
                    if(!existingUser) return new Error("No user linked to this blog");
                    if (!existingBlog) return new Error("Blog does not exist");
                    existingUser.blogs.pull(existingBlog);
                    await existingUser.save({ session });
                    return await Blog.deleteOne({ id: existingBlog.id });
                } catch (err) {
                    return new Error(err);
                } finally {
                    session.commitTransaction();
                }
            }
        },
        addCommentToBlog: {
            type: CommentType,
            args: {
                blog: { type: GraphQLNonNull(GraphQLID) },
                user: { type: GraphQLNonNull(GraphQLID) },
                text: { type: GraphQLNonNull(GraphQLString) },
                date: { type: GraphQLNonNull(GraphQLString) },
            },
            async resolve(parent,{ user, blog, text, date }) {
                const session = await startSession();
                let comment: DocumentType;
                try {
                    session.startTransaction({ session });
                    const existingUser = await User.findById(user);
                    const existingBlog = await Blog.findById(blog);
                    if(!existingBlog || !existingUser) return new Error("User or Blog does Not Exists");
                    comment = new Comment({
                        text,
                        date,
                        blog,
                        user,
                    });
                    existingUser.comments.push(comment);
                    existingBlog.comments.push(comment);
                    await existingBlog.save({ session });
                    await existingUser.save({ session });
                    return await comment.save({ session });
                } catch (err) {
                    return new Error(err);
                } finally {
                    await session.commitTransaction();
                }
            },
        },
        deleteComment: {
            type: CommentType,
            args: {
                id:{ type:GraphQLNonNull(GraphQLID) },
            },
            async resolve(parent,{ id }) {
                let comment: DocumentType;
                const session = await startSession();
                try {
                    session.startTransaction({ session });
                    comment = await Comment.findById(id);
                    if(!comment) return new Error("Comment not found");
                    //@ts-ignore
                    const existingUser = await User.findById(comment?.user);
                    if(!existingUser) return new Error("User Not Found");
                    //@ts-ignore
                    const existingBlog = await Blog.findById(comment?.blog);
                    if(!existingBlog) return new Error("Blog not found");
                    existingUser.comments.pull(comment);
                    existingBlog.comments.pull(comment);
                    await existingUser.save({ session });
                    await existingBlog.save({ session });
                    return await comment.deleteOne({ id: comment.id });
                } catch(err){

                } finally {
                    await session.commitTransaction();
                }
            }
        },
    },
});


export default new GraphQLSchema({ query: RootQuery, mutation: mutations });