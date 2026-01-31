import { CreateListData, CreateListVariables, GetPublicListsData, AddMovieToListData, AddMovieToListVariables, GetMoviesInListData, GetMoviesInListVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateList(options?: useDataConnectMutationOptions<CreateListData, FirebaseError, CreateListVariables>): UseDataConnectMutationResult<CreateListData, CreateListVariables>;
export function useCreateList(dc: DataConnect, options?: useDataConnectMutationOptions<CreateListData, FirebaseError, CreateListVariables>): UseDataConnectMutationResult<CreateListData, CreateListVariables>;

export function useGetPublicLists(options?: useDataConnectQueryOptions<GetPublicListsData>): UseDataConnectQueryResult<GetPublicListsData, undefined>;
export function useGetPublicLists(dc: DataConnect, options?: useDataConnectQueryOptions<GetPublicListsData>): UseDataConnectQueryResult<GetPublicListsData, undefined>;

export function useAddMovieToList(options?: useDataConnectMutationOptions<AddMovieToListData, FirebaseError, AddMovieToListVariables>): UseDataConnectMutationResult<AddMovieToListData, AddMovieToListVariables>;
export function useAddMovieToList(dc: DataConnect, options?: useDataConnectMutationOptions<AddMovieToListData, FirebaseError, AddMovieToListVariables>): UseDataConnectMutationResult<AddMovieToListData, AddMovieToListVariables>;

export function useGetMoviesInList(vars: GetMoviesInListVariables, options?: useDataConnectQueryOptions<GetMoviesInListData>): UseDataConnectQueryResult<GetMoviesInListData, GetMoviesInListVariables>;
export function useGetMoviesInList(dc: DataConnect, vars: GetMoviesInListVariables, options?: useDataConnectQueryOptions<GetMoviesInListData>): UseDataConnectQueryResult<GetMoviesInListData, GetMoviesInListVariables>;
